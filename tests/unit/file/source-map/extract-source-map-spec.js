var rewire = require('rewire');
var extract = rewire('../../../../src/file/source-map/extract-source-map');
var convert = require('convert-source-map');

describe('extract source map', function() {
	
	var result,
		inputComment,
		inputMapFileDir,
		mapFileContent;
	
	beforeEach(function() {

		spyOnSourceMapConvert();

	});

	var spyOnSourceMapConvert = function() {

		mapFileContent = undefined;
		inputComment = undefined;
		inputMapFileDir = undefined;

		extract.__set__('convert', {
			fromMapFileComment: function(comment, mapFileDir) {
				inputComment = comment;
				inputMapFileDir = mapFileDir;
				return mapFileContent;
			},
			fromComment: function(comment) {
				return convert.fromComment(comment); // retrun the real thing
			}
		})

	};
	
	describe('with inline base64 source maps', function() {

		it('Given code with no source mapping URL comment, returns original code.', function() {

			extractSourceMap('var x = 1;');

			assertCodeIs('var x = 1;');

		});

		it('Given code with no source mapping URL comment, does not return map.', function() {

			extractSourceMap('var x = 1;');

			assertMapIs(undefined);

		});

		it('Given JS code with source mapping URL comment, returns code with source mapping URL comment removed.', function() {

			extractSourceMap('var x = 1;\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6WyJhIiwiYiJdLCJtYXBwaW5ncyI6WyJBQUFBIiwiQkJCQiJdfQ==');

			assertCodeIs('var x = 1;');

		});

		it('Given JS code with source mapping URL comment, returns decoded source map.', function() {

			extractSourceMap('var x = 1;\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6WyJhIiwiYiJdLCJtYXBwaW5ncyI6WyJBQUFBIiwiQkJCQiJdfQ==');

			assertMapIs({
				version: 3,
				sources: ['foo.js'],
				names: ['a', 'b'],
				mappings: ['AAAA', 'BBBB']
			});

		});

		it('Given CSS code with source mapping URL comment, returns code with source mapping URL comment removed.', function() {

			extractSourceMap('.foo { background: red; }\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5sZXNzIl0sIm5hbWVzIjpbImEiLCJiIl0sIm1hcHBpbmdzIjpbIkFBQUEiLCJCQkJCIl19 */');

			assertCodeIs('.foo { background: red; }');

		});

		it('Given CSS code with source mapping URL comment, returns decoded source map.', function() {

			extractSourceMap('.foo { background: red; }\n/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5sZXNzIl0sIm5hbWVzIjpbImEiLCJiIl0sIm1hcHBpbmdzIjpbIkFBQUEiLCJCQkJCIl19 */');

			assertMapIs({
				version: 3,
				sources: ['foo.less'],
				names: ['a', 'b'],
				mappings: ['AAAA', 'BBBB']
			});

		});
		
		var extractSourceMap = function(code) {

			result = extract(code, 'C:/somewhere/');

		};
	
	});

	describe('with json source maps in separate file', function() {
		
		var rootDir = 'C:/somewhere/';

		it('Given code with no source mapping URL comment, returns original code.', function() {

			extractSourceMap('var x = 1;');

			assertCodeIs('var x = 1;');

		});

		it('Given code with no source mapping URL comment, does not return map.', function() {

			extractSourceMap('var x = 1;');

			assertMapIs(undefined);

		});

		it('Given JS code with source mapping URL comment, returns code with source mapping URL comment removed.', function() {

			extractSourceMap('var x = 1;\n//# sourceMappingURL=theFile.js.map');

			assertCodeIs('var x = 1;');
		});

		it('Given JS code with source mapping URL comment, returns source map.', function() {

			givenMapFileContent('{ "version": 3,"sources": ["foo.js"],"names": ["a", "b"],"mappings": ["AAAA", "BBBB"] }');
		
			var sourceMapComment = '\n//# sourceMappingURL=theFile.js.map';
		
			extractSourceMap('var x = 1;' + sourceMapComment);

			assertMapIs({
				version: 3,
				sources: ['foo.js'],
				names: ['a', 'b'],
				mappings: ['AAAA', 'BBBB']
			});

			assertExtractMapFromFileCommentInput(sourceMapComment, rootDir);
		});

		it('Given CSS code with source mapping URL comment, returns code with source mapping URL comment removed.', function() {

			extractSourceMap('.foo { background: red; }\n/*# sourceMappingURL=theFile.css.map */');

			assertCodeIs('.foo { background: red; }');

		});

		it('Given CSS code with source mapping URL comment, returns source map.', function() {

			givenMapFileContent('{ "version": 3,"sources": ["foo.less"],"names": ["a", "b"],"mappings": ["AAAA", "BBBB"] }');
		
			var sourceMapComment = '\n/*# sourceMappingURL=theFile.css.map */';
		
			extractSourceMap('.foo { background: red; }' + sourceMapComment);

			assertMapIs({
				version: 3,
				sources: ['foo.less'],
				names: ['a', 'b'],
				mappings: ['AAAA', 'BBBB']
			});
			
			assertExtractMapFromFileCommentInput(sourceMapComment, rootDir);

		});
		
		var extractSourceMap = function(code) {

			result = extract(code, rootDir);

		};
		
		var assertExtractMapFromFileCommentInput = function(sourceMapComment, rootDir) {
			expect(inputComment).toEqual(sourceMapComment);
			expect(inputMapFileDir).toEqual(rootDir);
		};
		
	});
	
	var givenMapFileContent = function(mapContent) {
		
		mapFileContent = convert.fromJSON(mapContent);
		
	};

    var assertCodeIs = function(expected) {

        expect(result.code).toEqual(expected);

    };

    var assertMapIs = function(expected) {

        expect(result.map).toEqual(expected);

    };

});