var Concat = require('concat-with-sourcemaps');

function CodeFile(type) {

    this.type = type;
    this.files = [];

}

CodeFile.prototype.addFile = function(index, code, map) {

    this.files[index] = {
        code: code,
        map: map
    };

};

CodeFile.prototype.concatenate = function(options) {

    var concat = new Concat(options.sourceMap, '', '\n');
    var prefix = this.type === CodeFile.Type.JS ? ';' : '';

    this.files.forEach(function(file) {
        concat.add(null, prefix + file.code, JSON.stringify(file.map));
    });

    return {
        code: concat.content.toString(),
        map: concat.sourceMap ? JSON.parse(concat.sourceMap) : undefined
    };

};

CodeFile.Type = {
    CSS: 'css',
    JS: 'js'
};

module.exports = CodeFile;