var compileES6 = require('../../../src/compile/compile-es6');
var _ = require('underscore');
var path = require('path');

describe('compile ES6', function() {

    var sourceMap,
        inputPath;

    beforeEach(function() {

        sourceMap = false;
        inputPath = 'C:\\foo\\bar.es6';

    });

    it('Given ES6 code with arrow function, compiles to ES5.', function(done) {

        compile('[1, 2].map(num => num * 2);')
            .then(assertResultIs(
                '[1, 2].map(function (num) {\n' +
                '  return num * 2;\n' +
                '});',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with template string, compiles to ES5.', function(done) {

        compile('var name = "Bob"; var result = `Hello ${name}`;')
            .then(assertResultIs(
                'var name = "Bob";var result = "Hello " + name;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with multi-line template string, compiles to ES5.', function(done) {

        compile('var x = `this is a multi-\nline string`;')
            .then(assertResultIs(
                'var x = "this is a multi-\\nline string";',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with destructured variable assignment with an array, compiles to ES5.', function(done) {

        compile('var [a, b] = [1,2];')
            .then(assertResultIs(
                'var a = 1;\n' +
                'var b = 2;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with destructured variable assignment with default values, compiles to ES5.', function(done) {

        compile('var [a = 1] = [];')
            .then(assertResultIs(
                'var _ref = [];\n' +
                'var _ref$ = _ref[0];\n' +
                'var a = _ref$ === undefined ? 1 : _ref$;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with destructured variable assignment skipping array elements, compiles to ES5.', function(done) {

        compile('var [a, , b] = [1,2,3];')
            .then(assertResultIs(
                'var _ref = [1, 2, 3];\n' +
                'var a = _ref[0];\n' +
                'var b = _ref[2];',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with destructured variable assignment with an object, compiles to ES5.', function(done) {

        compile('var {a, b} = {a:1, b:2};')
            .then(assertResultIs(
                'var _a$b = { a: 1, b: 2 };\n' +
                'var a = _a$b.a;\n' +
                'var b = _a$b.b;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with default function parameters, compiles to ES5.', function(done) {

        compile('function f(x = 1) { return x; }')
            .then(assertResultIs(
                'function f() {\n' +
                '  var x = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];\n' +
                '  return x;\n' +
                '}',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with rest parameter, compiles to ES5.', function(done) {

        compile('function f(x, ...y) { return x + y.length; }')
            .then(assertResultIs(
                'function f(x) {\n' +
                '  return x + (arguments.length - 1);\n' +
                '}',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with let variables, compiles to ES5.', function(done) {

        compile('let x = 5;')
            .then(assertResultIs(
                'var x = 5;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with const variables, compiles to ES5.', function(done) {

        compile('const x = 5;')
            .then(assertResultIs(
                'var x = 5;',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with function shorthand, compiles to ES5.', function(done) {

        compile('var x = { foo() { return 1; } };')
            .then(assertResultIs(
                'var x = {\n' +
                '  foo: function foo() {\n' +
                '    return 1;\n' +
                '  }\n' +
                '};',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with async/await, compiles to ES5.', function(done) {

        compile(
                'async function foo() {\n' +
                '    return await new Promise(function(resolve, reject) {\n' +
                '        resolve(1);\n' +
                '    });\n' +
                '}'
            )
            .then(assertResultIs(
                'function foo() {\n' +
                '    return regeneratorRuntime.async(function foo$(_context) {\n' +
                '        while (1) {\n' +
                '            switch (_context.prev = _context.next) {\n' +
                '                case 0:\n' +
                '                    _context.next = 2;\n' +
                '                    return regeneratorRuntime.awrap(new Promise(function (resolve, reject) {\n' +
                '                        resolve(1);\n' +
                '                    }));\n' +
                '\n' +
                '                case 2:\n' +
                '                    return _context.abrupt("return", _context.sent);\n' +
                '\n' +
                '                case 3:\n' +
                '                case "end":\n' +
                '                    return _context.stop();\n' +
                '            }\n' +
                '        }\n' +
                '    }, null, this);\n' +
                '}',
                done
            ))
            .catch(throwError);

    });

    it('Given ES6 code with source maps enabled, compiles to ES5 with source map.', function(done) {

        givenInputFileIs('C:\\foo\\bar.es6');
        givenSourceMapsEnabled();

        compile('const x = 5;')
            .then(assertResultIs({
                    code:
                        'var x = 5;',
                    map: {
                        version: 3,
                        sources: ['C:\\foo\\bar.es6'],
                        names: [],
                        mappings: 'AAAA,IAAM,CAAC,GAAG,CAAC,CAAC',
                        file: 'unknown',
                        sourcesContent: ['const x = 5;']
                    }
                },
                done
            ))
            .catch(throwError);

    });

    it('Given invalid ES6 code, throws error.', function(done) {

        compile('let x =')
            .then(assertResultWasNotReturned)
            .catch(assertErrorIsThrown(done));

    });

    var compile = function(code) {

        return compileES6({
            code: code,
            sourceMap: sourceMap,
            inputPath: inputPath
        });

    };

    var givenInputFileIs = function(filePath) {

        inputPath = filePath;

    };

    var givenSourceMapsEnabled = function() {

        sourceMap = true;

    };

    var assertResultIs = function(expected, done) {

        return function(result) {

            if (_.isString(expected)) {
                expect(result.code).toEqual(expected);
                expect(result.map).toBeNull();
            } else {
                expect(result).toEqual(expected);
            }

            done();

        };

    };

    var assertResultWasNotReturned = function() {

        throw 'Compile should not have succeeded!';

    };

    var assertErrorIsThrown = function(done) {

        return function(err) {

            expect(err).not.toBeUndefined();

            done();

        };

    };

    var throwError = function(err) {

        throw err;

    };

});