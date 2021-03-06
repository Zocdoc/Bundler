/*
Copyright (c) 2012 Demis Bellot <demis.bellot@gmail.com>

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// uncaught exceptions should cause the application to crash and exit
// with an exit code that will be identified as a failure by most
// windows build systems

var handleError = function(err) {
    if (err.stack) {
        console.error(err.stack);
    } else {
        var jsonError = JSON.stringify(err, null, 4);
        if (jsonError !== '{}') {
            console.error(jsonError);
        } else {
            console.error(err.message);
        }
    }
    process.exit(1);
};

process.on("uncaughtException", handleError);

var fs = require("fs"),
    path = require("path"),
    Step = require('step'),
    hashingRequire = require('./bundle-stats.js'),
    bundlefiles = require('./bundle-files.js'),
    bundleStatsCollector = new hashingRequire.BundleStatsCollector(),
    optionsRequire = require('./bundle-options.js'),
    bundleFileUtilityRequire = require('./bundle-file-utility.js'),
    bundleFileUtility,
    bundlerOptions = new optionsRequire.BundlerOptions(),
    urlRewrite = require('./bundle-url-rewrite.js'),
    _ = require('underscore'),
    collection = require('./collection'),
    cssValidator = require('./css-validator'),
    readTextFile = require('./read-text-file'),
    compile = require('./compile'),
    minify = require('./minify'),
    concat = require('./concat'),
    file = require('./file'),
    webpack = require('./webpack'),
    sourceMap = require('convert-source-map'),
    urlVersioning = null,
    Promise = require('bluebird');

bundleFileUtility = new bundleFileUtilityRequire.BundleFileUtility(fs);

bundlerOptions.ParseCommandLineArgs(process.argv.splice(2));

if (!bundlerOptions.Directories.length) {
    console.log("No directories were specified.");
    console.log("Usage: bundler.js [#option:value] ../Content [../Scripts]");
    return;
}

if(bundlerOptions.DefaultOptions.statsfileprefix) {
    bundleStatsCollector.setFilePrefix(bundlerOptions.DefaultOptions.statsfileprefix);
}

if(bundlerOptions.DefaultOptions.rewriteimagefileroot && bundlerOptions.DefaultOptions.rewriteimageoutputroot) {
    urlVersioning = new urlRewrite.BundleUrlRewriter(
        fs,
        bundlerOptions.DefaultOptions.rewriteimageoutputroot,
        bundlerOptions.DefaultOptions.rewriteimagefileroot,
        bundlerOptions.DefaultOptions.hashedfiledirectory
    );
}

bundleStatsCollector.Console = console;
bundleStatsCollector.LoadStatsFromDisk(bundlerOptions.DefaultOptions.outputdirectory || process.cwd());

var walk = function (dir, done) {
    var results = new bundlefiles.BundleFiles();
    fs.readdir(dir, function (err, list) {
        if (err) throw err;
        var i = 0;
        (function next() {
            var file = list[i++];
            if (!file) return done(null, results);
            file = dir + '/' + file;
            fs.stat(file, function (_, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (_, res) {
                        results.addFiles(res.files);
                        next();
                    });
                } else {
                    results.addFile(file);
                    next();
                }
            });
        })();
    });
};

var scanIndex = 0;
(function scanNext() {
    if (scanIndex < bundlerOptions.Directories.length) {
        var rootDir = bundlerOptions.Directories[scanIndex++];
        fs.exists(rootDir, function(exists) {
            if (exists) {
                walk(rootDir, function(err, allFiles) {
                    if (err) throw err;
                    scanDir(allFiles, scanNext);
                });
            } else {
                console.log("\nSpecified dir '" + rootDir + "' does not exist, skipping...");
                scanNext();
            }
        });
    } else {
        bundleStatsCollector.SaveStatsToDisk(bundlerOptions.DefaultOptions.outputdirectory || process.cwd());
    }
})();

function scanDir(allFiles, cb) {

    allFiles.Index();

    var jsBundles  = allFiles.getBundles(bundlefiles.BundleType.Javascript);
    var cssBundles = allFiles.getBundles(bundlefiles.BundleType.Css);

    Step(
        function () {
            var next = this;
            var index = 0;
            var nextBundle = function () {
                if (index < jsBundles.length)
                    processBundle(jsBundles[index++]);
                else
                    next();
            };
            function processBundle(jsBundle) {
                var bundleDir = path.dirname(jsBundle);
                var bundleName = jsBundle.replace('.bundle', '');

                readTextFile(jsBundle, function (data) {
                    var jsFiles = removeCR(data).split("\n");
                    var options = bundlerOptions.getOptionsForBundle(jsFiles);

                    bundleName = bundleFileUtility.getOutputFilePath(bundleName, bundleName, options);

                    var tmpFiles = collection.createBundleFiles(jsBundle);

                    jsFiles.forEach(function(name) {

                        if(name.startsWith('#')) { return; }

                        var currentItem = bundleDir + '/' +  name;
                        var stat = fs.statSync(currentItem);
                        if(!stat.isDirectory()) {
                            tmpFiles.addFile(name);
                        }
                        else if(currentItem != bundleDir + '/'){

                            var filesInDir = allFiles.getFilesInDirectory(
                                                bundlefiles.BundleType.Javascript,
                                                currentItem,
                                                name,
                                                options
                                            );
                            _.chain(filesInDir).filter(function(a) { return a.endsWith(".mustache")}).each(tmpFiles.addFile, tmpFiles);
                            _.chain(filesInDir).filter(function(a) { return a.endsWith(".js") || a.endsWith(".jsx") || a.endsWith(".es6") || a.endsWith(".json"); }).each(tmpFiles.addFile, tmpFiles);
                        }
                    });

                    jsFiles = tmpFiles.toJSON();

                    processJsBundle(options, jsBundle, bundleDir, jsFiles, bundleName, nextBundle);
                });
            };
            nextBundle();
        },
        function () {
            var next = this;
            var index = 0;
            var nextBundle = function () {
                if (index < cssBundles.length)
                    processBundle(cssBundles[index++]);
                else
                    next();
            };
            function processBundle(cssBundle) {
                var bundleDir = path.dirname(cssBundle);
                var bundleName = cssBundle.replace('.bundle', '');

                readTextFile(cssBundle, function (data) {
                    var cssFiles = removeCR(data).split("\n");
                    var options = bundlerOptions.getOptionsForBundle(cssFiles);

                    bundleName = bundleFileUtility.getOutputFilePath(bundleName, bundleName, options);

                    var tmpFiles = collection.createBundleFiles(cssBundle);

                    cssFiles.forEach(function(name) {

                        if(name.startsWith('#')) { return; }

                        var currentItem = bundleDir + '/' +  name;
                        var stat = fs.statSync(currentItem);
                        if(!stat.isDirectory()) {
                            tmpFiles.addFile(name);
                        }
                        else if(currentItem != bundleDir + '/'){

                            var cssFiles = allFiles.getFilesInDirectory(
                                bundlefiles.BundleType.Css,
                                currentItem,
                                name,
                                options
                            );

                            _.each(cssFiles, tmpFiles.addFile, tmpFiles);
                        }
                    });

                    cssFiles = tmpFiles.toJSON();

                    processCssBundle(options, cssBundle, bundleDir, cssFiles, bundleName, nextBundle);
                });
            }
            nextBundle();
        },
        cb
    );
}

function processJsBundle(options, jsBundle, bundleDir, jsFiles, bundleName, cb) {

    var processedFiles = {};

    var allJsArr = [], allMinJsArr = [], index = 0, pending = 0;
    var whenDone = function () {

        var sourceMap = options.sourcemaps && !options.webpack;

        concat.files({
                files: allJsArr,
                fileType: file.type.JS,
                sourceMap: sourceMap,
                require: options.require,
                bundleName: jsBundle,
                bundleStatsCollector: bundleStatsCollector
            })
            .then(function(allJs) {

                return file.write(allJs.code, allJs.map, file.type.JS, bundleName, options.siterootdirectory);

            })
            .then(function() {

                return concat.files({
                    files: allMinJsArr,
                    fileType: file.type.JS,
                    sourceMap: sourceMap,
                    require: options.require,
                    bundleName: jsBundle,
                    bundleStatsCollector: bundleStatsCollector
                });

            })
            .then(function(allMinJs) {

                var minFileName = bundleFileUtility.getMinFileName(bundleName, bundleName, options);
                var hash = bundleStatsCollector.AddFileHash(bundleName, allMinJs.code);

                if (bundlerOptions.DefaultOptions.hashedfiledirectory) {
                    return file.write(allMinJs.code, allMinJs.map, file.type.JS, minFileName, options.siterootdirectory)
                        .then(function() {
                            var fileNameWithHash = bundleFileUtility.getBundleWithHashname(bundleName, hash, options);
                            return file.write(allMinJs.code, allMinJs.map, file.type.JS, fileNameWithHash, options.siterootdirectory);
                        });
                } else {
                    return file.write(allMinJs.code, allMinJs.map, file.type.JS, minFileName, options.siterootdirectory);
                }
            })
            .then(cb)
            .catch(handleError);

        if (options.require) {
            bundleStatsCollector.AddDebugFile(jsBundle, bundleName);
        } else {
            allJsArr.forEach(function(jsFile) {
                bundleStatsCollector.AddDebugFile(jsBundle, jsFile.path);
            });
        }

    };

    bundleStatsCollector.ClearStatsForBundle(jsBundle);

    if (options.webpack) {
        webpack.validate({
            files: jsFiles,
            fileType: file.type.JS
        });
    }

    jsFiles.forEach(function (file) {
        // Skip blank lines/files beginning with '.' or '#', but allow ../relative paths

        if (!(file = file.trim())
            || (file.startsWith(".") && !file.startsWith(".."))
            || file.startsWith('#')
            || processedFiles[file])
            return;

        processedFiles[file] = true;

        var isMustache = file.endsWith(".mustache");
        var isJsx = file.endsWith(".jsx");
        var isES6 = file.endsWith(".es6");
        var isJson = file.endsWith(".json");
        var jsFile = isMustache ? file.replace(".mustache", ".js")
                   : isJsx ? file.replace(".jsx", ".js")
                   : isES6 ? file.replace(".es6", ".js")
	           : file;

        var filePath = path.join(bundleDir, file),
              jsPath = path.join(bundleDir, jsFile),
              jsPathOutput = bundleFileUtility.getOutputFilePath(bundleName, jsPath, options),
              minJsPath = bundleFileUtility.getMinFileName(bundleName, jsPathOutput,  options);

        var i = index++;
        pending++;
        Step(
            function () {

                var next = this;

                if (isMustache || isJsx || isES6) {
                    jsPath = jsPathOutput;
                }

                readTextFile(filePath, function(code) {

                    var compileOptions = {
                        code: code,
                        originalPath: filePath,
                        inputPath: filePath,
                        outputPath: jsPathOutput,
                        bundleDir: bundleDir,
                        bundleStatsCollector: bundleStatsCollector,
                        sourceMap: options.sourcemaps,
                        require: options.require,
                        siteRoot: options.siterootdirectory,
                        useTemplateDirs: options.usetemplatedirs
                    };

                    if (isJson) {

                        bundleStatsCollector.ParseJsonForStats(jsBundle, filePath, code);
                        if (! --pending) whenDone();

                    } else if (isMustache) {

                        bundleStatsCollector.ParseMustacheForStats(jsBundle, code);
                        compile.mustache(compileOptions).then(next).catch(handleError);

                    } else if (isJsx) {

                        bundleStatsCollector.ParseJsForStats(jsBundle, code);
                        compile.jsx(compileOptions).then(next).catch(handleError);

                    } else if (isES6) {

                        bundleStatsCollector.ParseJsForStats(jsBundle, code);
                        compile.es6(compileOptions).then(next).catch(handleError);

                    } else {

                        if (options.webpack) {

                            code = sourceMap.removeComments(code);
                            code = sourceMap.removeMapFileComments(code);

                        }

                        bundleStatsCollector.ParseJsForStats(jsBundle, code);
                        next({
                            code: code,
                            path: jsPath,
                            originalPath: filePath
                        });

                    }


                });

            },
            function (js) {
                if (options.webpack) {

                    if (jsPath.endsWith('.min.js')) {
                        allMinJsArr[i] = js;
                    } else {
                        allJsArr[i] = js;
                    }

                    if (! --pending) whenDone();

                } else {

                    allJsArr[i] = js;
                    var withMin = function (minJs) {
                        allMinJsArr[i] = minJs;

                        if (! --pending) whenDone();
                    };

                    minify.js({
                        code: js.code,
                        map: js.map,
                        originalPath: filePath,
                        inputPath: jsPath,
                        outputPath: minJsPath,
                        bundleDir: bundleDir,
                        bundleStatsCollector: bundleStatsCollector,
                        sourceMap: options.sourcemaps,
                        siteRoot: options.siterootdirectory,
                        useTemplateDirs: options.usetemplatedirs
                    }).then(withMin).catch(handleError);

                }
            }
        );
    });
}

function processCssBundle(options, cssBundle, bundleDir, cssFiles, bundleName, cb) {

    var processedFiles = {};

    var allCssArr = [], allMinCssArr = [], index = 0, pending = 0;
    var whenDone = function () {

        var sourceMap = options.sourcemaps && !options.webpack;

        allCssArr.forEach(function(cssFile) {
            bundleStatsCollector.AddDebugFile(cssBundle, cssFile.path);
        });

        concat.files({
                files: allCssArr,
                fileType: file.type.CSS,
                sourceMap: sourceMap,
                bundleName: cssBundle,
                bundleStatsCollector: bundleStatsCollector
            })
            .then(function(allCss) {

                return file.write(allCss.code, allCss.map, file.type.CSS, bundleName, options.siterootdirectory);

            })
            .then(function() {

                return concat.files({
                    files: allMinCssArr,
                    fileType: file.type.CSS,
                    sourceMap: sourceMap,
                    bundleName: cssBundle,
                    bundleStatsCollector: bundleStatsCollector
                });

            })
            .then(function(allMinCss) {

                var code = allMinCss.code;
                if (urlVersioning) {
                    code = urlVersioning.VersionHashUrls(allMinCss.code);
                    allMinCss.code = urlVersioning.VersionUrls(allMinCss.code);
                }

                return new Promise.all([
                    cssValidator.validate(cssBundle, allMinCss),
                    cssValidator.validate(cssBundle, {
                        code: code
                    })
                ]);
            })
            .then(function(minifiedCss) {

                var allMinCss = minifiedCss[0];

                var hash = bundleStatsCollector.AddFileHash(bundleName, allMinCss.code);

                var minFileName = bundleFileUtility.getMinFileName(bundleName, bundleName, options);
                var fileNameWithHash = minFileName.replace('.min.', '__' + hash + '__' + '.min.');

                if (bundlerOptions.DefaultOptions.hashedfiledirectory) {
                    return file.write(allMinCss.code, allMinCss.map, file.type.CSS, minFileName, options.siterootdirectory)
                        .then(function() {
                            var fileNameWithHash = bundleFileUtility.getBundleWithHashname(bundleName, hash, options);
                            return file.write(minifiedCss[1].code, allMinCss.map, file.type.CSS, fileNameWithHash, options.siterootdirectory);
                        });
                } else {
                    return file.write(allMinCss.code, allMinCss.map, file.type.CSS, minFileName, options.siterootdirectory);
                }
            })
            .then(cb)
            .catch(handleError);

    };

    bundleStatsCollector.ClearStatsForBundle(cssBundle);

    if (options.webpack) {
        webpack.validate({
            files: cssFiles,
            fileType: file.type.CSS
        });
    }

    cssFiles.forEach(function (file) {
        if (!(file = file.trim())
            || (file.startsWith(".") && !file.startsWith(".."))
            || file.startsWith('#')
            || processedFiles[file])
            return;

        processedFiles[file] = true;

        var isLess = file.endsWith(".less");
        var cssFile = isLess ?
            file.replace(".less", ".css")
            : file;

        var filePath = path.join(bundleDir, file),
            cssPath = path.join(bundleDir, cssFile),
            cssPathOutput = bundleFileUtility.getOutputFilePath(bundleName, cssPath, options),
            minCssPath = bundleFileUtility.getMinFileName(bundleName, cssPathOutput, options);

        var i = index++;
        pending++;
        Step(
            function () {

                var next = this;

                if (isLess) {
                    cssPath = cssPathOutput;
                }

                readTextFile(filePath, function(code) {

                    var compileOptions = {
                        code: code,
                        originalPath: filePath,
                        inputPath: filePath,
                        outputPath: cssPathOutput,
                        bundleDir: bundleDir,
                        bundleStatsCollector: bundleStatsCollector,
                        sourceMap: options.sourcemaps,
                        siteRoot: options.siterootdirectory,
                        useTemplateDirs: options.usetemplatedirs
                    };

                    if (isLess) {

                        compile.less(compileOptions).then(next).catch(handleError);

                    } else {

                        if (options.webpack) {

                            code = sourceMap.removeComments(code);
                            code = sourceMap.removeMapFileComments(code);

                        }

                        next({
                            code: code,
                            path: cssPath,
                            originalPath: filePath
                        });

                    }

                });

            },
            function (css) {
                if (options.webpack) {

                    if (cssPath.endsWith('.min.css')) {
                        allMinCssArr[i] = css;
                    } else {
                        allCssArr[i] = css;
                    }

                    if (!--pending) whenDone();

                } else {

                    allCssArr[i] = css;
                    var withMin = function (minCss) {
                        allMinCssArr[i] = minCss;

                        if (!--pending) whenDone();
                    };

                    minify.css({
                        code: css.code,
                        map: css.map,
                        originalPath: filePath,
                        inputPath: cssPath,
                        outputPath: minCssPath,
                        bundleDir: bundleDir,
                        bundleStatsCollector: bundleStatsCollector,
                        sourceMap: options.sourcemaps,
                        siteRoot: options.siterootdirectory,
                        useTemplateDirs: options.usetemplatedirs
                    }).then(withMin).catch(handleError);

                }
            }
        );
    });
}

function removeCR(text) {
    return text.replace(/\r/g, '');
}
