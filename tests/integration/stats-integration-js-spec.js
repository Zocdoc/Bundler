var testDirectory = 'stats-test-suite-js';
var integrationTest = require('./helpers/jasmine-wrapper.js');
var test = new integrationTest.Test(integrationTest.TestType.Js, testDirectory);

test.describeIntegrationTest("Integration Tests for Bundle Stats Collecting JS:", function() {

    beforeEach(function () {
        test.given.StagingDirectoryIs('staging-dir');
        test.given.OutputDirectoryIs('output-dir');
        test.given.HashedDirectoryIs('hashing-dir');
        test.given.FileToBundle('file1.js',       'var file1 = "file1";');
        test.given.FileToBundle('file2.js',       'var file2 = "file2";');
        test.given.FileToBundle('file3.mustache', '<div> {{a}} </div>');
    });

    describe("Hashing: ", function() {

        it("Computes a hash for all bundles and puts it in the output directory.", function () {

            test.actions.Bundle();

            test.assert.verifyJson(
                test.given.OutputDirectory,
                'bundle-hashes.json',
                function (json) {

                    var properties = Object.getOwnPropertyNames(json);
                    expect(properties.length).toBe(1);
                    expect(properties[0]).toBe('test.js');
                    expect(json['test.js']).toBe("973896bdfac006e8574adfb9210670eb");
                });
        });

        it("outputs a minified file in the output directory", function () {

            test.actions.Bundle();

            test.assert.verifyFileExists(test.given.OutputDirectory, 'test.min.js');
        });

        it("outputs a minified file with the hash in the hashed directory", function () {

            test.actions.Bundle();

            test.assert.verifyFileExists(test.given.HashedDirectory, 'test__973896bdfac006e8574adfb9210670eb__.min.js');
        });
    });

    describe("Debug Files: ", function () {

        it("Computes a collection of files for all bundles and puts it in the output directory.", function () {

            test.actions.Bundle();

            test.assert.verifyJson(
                test.given.OutputDirectory,
                'bundle-debug.json',
                function (json) {
                    validateJsonObject(json, function (b) {
                        expect(b).toEqual([
                            'stats-test-suite-js\\test\\file1.js',
                            'stats-test-suite-js\\test\\file2.js',
                            './stats-test-suite-js/staging-dir/testjs/test-file3.js'
                        ]);
                    });
                });
        });

        it('Given require option, computes a collection with just the combined, unminified bundle file and puts it in the output directory.', function() {

            test.given.BundleOption('require');

            test.actions.Bundle();

            test.assert.verifyJson(
                test.given.OutputDirectory,
                'bundle-debug.json',
                function (json) {
                    validateJsonObject(json, function (b) {
                        expect(b).toEqual([
                            test.given.StagingDirectory + '/testjs/test.js'
                        ]);
                    });
                });

        });

    });

    describe("Localization Files: ", function () {

        it("Computes a set of localized strings for all bundles and puts it in the output directory.", function () {

            test.given.FileToBundle('file3.js', "// @localize js1.string\ni18n.t('js2.string');\ni18n.t(\"js3.string\");");
            test.given.FileToBundle('file4.mustache', "{{# i18n }}js4.string{{/ i18n }}");
            test.given.FileToBundle('file5.mustache', "{{# i18n }}js5.string{{/ i18n }}");

            test.actions.Bundle();

            test.assert.verifyJson(
                test.given.OutputDirectory,
                'bundle-localization-strings.json',
                function (json) {
                    validateJsonObject(json, function (b) {
                        expect(b.indexOf('js1.string') >= 0).toBe(true);
                        expect(b.indexOf('js2.string') >= 0).toBe(true);
                        expect(b.indexOf('js3.string') >= 0).toBe(true);
                        expect(b.indexOf('js4.string') >= 0).toBe(true);
                        expect(b.indexOf('js5.string') >= 0).toBe(true);
                    });
                });
        });
    });

    describe("Ab Config Files: ", function () {

        it("Computes a set of localized strings for all bundles and puts it in the output directory.", function () {

            test.given.FileToBundle('file3.js', "{AB.isOn('ab.config.1');}\nvar x=12;i18n.t('ab.config.2');");
            test.given.FileToBundle('file4.js', "AB.isOn('ab.config.3');");

            test.actions.Bundle();

            test.assert.verifyJson(
                test.given.OutputDirectory,
                'bundle-ab-configs.json',
                function (json) {
                    validateJsonObject(json, function (b) {
                        expect(b.indexOf('ab.config.1') >= 0).toBe(true);
                        expect(b.indexOf('ab.config.3') >= 0).toBe(true);
                        expect(b.indexOf('ab.config.2') >= 0).toBe(false);
                    });
                });
        });
    });

    var validateJsonObject = function (json, validateBundleFunc) {
        var properties = Object.getOwnPropertyNames(json);
        expect(properties.length).toBe(1);
        expect(properties[0]).toBe('test.js.bundle');
        validateBundleFunc(json['test.js.bundle']);
    };

});
