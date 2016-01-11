var CleanCss = require('clean-css');

/**
 * @param {object} options
 * @param {string} options.code
 * @param {string} options.filePath
 * @param {function} options.success
 * @param {function} options.error
 */
function minify(options) {

    try {

        var cleaner = new CleanCss({
            advanced: false,
            restructuring: false
        });

        cleaner.minify(options.code, function (err, result) {

            if (err) {
                options.error(err);
            } else {
                options.success(result.styles);
            }

        });

    } catch (err) {

        options.error(err);

    }

}

module.exports = minify;