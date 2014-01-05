
describe("Javascript Bundling: ", function() {

  var exec = require('child_process').exec,
    fs = require('fs'),
    testCase = require('./bundler-test-case.js'),
    getTestCase = function(directory, outputDirectory) { 
      return  new testCase.BundlerTestCase(
          directory,
          ".js",
          outputDirectory,
          exec,
          runs,
          waitsFor,
          fs
      );
    },
    runTestCase = function (
        directory,
        outputDirectory,
        logToConsole
    ) {
        var testCase = getTestCase(directory, outputDirectory);

        if (logToConsole) {
            testCase.Console = console;
        }

        testCase.RunBundlerAndVerifyOutput();
    };

  it("Concatenates individual files in a .bundle file into a single minified bundle.", function() {
         runTestCase("combines-individual-js-files");
  });  

  it("Compiles and Concatenates .mustache files", function() {
      runTestCase("combines-mustache");
  });

  it("Compiles and Concatenates .mustache files with js files", function() {
      runTestCase("combines-mustache-and-js");
  });

  it("Folder option by default minifies, but does not bundle."
    , function() {

        var minFiles = ["file1.min", "file2.min", "file3.min"];
        var minShouldExist = false;
        var testCase = getTestCase("default-folder-option");

        testCase.VerifySetUp = function () {
            testCase.VerifyFileState(minFiles, minShouldExist)
        };

        testCase.VerifyBundle = function () {
            minShouldExist = true;
            testCase.VerifySetUp();
            testCase.VerifyFileState(["test.min"], false);
        };

        testCase.RunBundlerAndVerifyOutput();
  });
 
  it("The recursive option on a folder searches sub-directories.", function () {
      runTestCase("recursive-folder-js");
  });

  it("The directory option allows entire subdirectories to be included", function () {
      runTestCase("directory-source-js");
  });

  it("Folder option will bundle with force bundle option", function () {
      runTestCase("combines-folder-with-forcebundle");
  });

  it("Listing items within a listed directory preferentially orders them.", function () {
      runTestCase("preferential-ordering-js");
  });

  it("If an output directory is specified, then the minified bundle is put in it.", function () {
      runTestCase("output-directory-js", "/folder-output/");
  });

});
