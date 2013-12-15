define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var Tokenizer = require("../tokenizer").Tokenizer;
var ConsoleHighlightRules = require("./console_highlight_rules").ConsoleHighlightRules;
// TODO: pick appropriate fold mode
var FoldMode = require("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = ConsoleHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
           
}).call(Mode.prototype);

exports.Mode = Mode;
});