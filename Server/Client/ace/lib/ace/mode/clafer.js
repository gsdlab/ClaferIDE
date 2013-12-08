define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var Tokenizer = require("../tokenizer").Tokenizer;
var ClaferHighlightRules = require("./clafer_highlight_rules").ClaferHighlightRules;
// TODO: pick appropriate fold mode
var FoldMode = require("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = ClaferHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
       
    this.lineCommentStart = ["//"];
    this.blockComment = [
        {start: "/*", end: "*/"}
    ];
    
}).call(Mode.prototype);

exports.Mode = Mode;
});