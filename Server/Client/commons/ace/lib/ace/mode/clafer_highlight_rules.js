define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var ClaferHighlightRules = function() {
    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used

    this.$rules = { start: 
       [ { caseInsensitive: true,
           token: 'keyword.control.clafer',
           regex: '\\b(?:(abstract|or|xor|mux|opt|max|min|this|sum|integer|string))\\b' },
         { token: 'constant.numeric.clafer',
           regex: '\\b((0(x|X)[0-9a-fA-F]*)|(([0-9]+\\.?[0-9]*)|(\\.[0-9]+))((e|E)(\\+|-)?[0-9]+)?)(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b' },
         { token: 'punctuation.definition.comment.clafer',
           regex: '//.*$',
           push_: 
            [ { token: 'comment.line.double-slash.clafer.two',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.double-slash.clafer.two' } ] },
         { token: 'punctuation.definition.comment.clafer',
           regex: '\\/\\*',
           push: 
            [ { token: 'punctuation.definition.comment.clafer',
                regex: '\\*\\/',
                next: 'pop' },
              { defaultToken: 'comment.block.clafer.one' } ] },
         { token: 'punctuation.definition.comment.clafer',
           regex: '\\{',
           push: 
            [ { token: 'punctuation.definition.comment.clafer',
                regex: '\\}',
                next: 'pop' },
              { defaultToken: 'comment.block.clafer.two' } ] },
         { token: 'punctuation.definition.string.begin.clafer',
           regex: '"',
           push: 
            [ { token: 'constant.character.escape.clafer', regex: '\\\\.' },
              { token: 'punctuation.definition.string.end.clafer',
                regex: '"',
                next: 'pop' },
              { defaultToken: 'string.quoted.double.clafer' } ],
           //Double quoted strings are an extension and (generally) support C-style escape sequences.
            },
         { token: 'punctuation.definition.string.begin.clafer',
           regex: '\'',
           push: 
            [ { token: 'constant.character.escape.apostrophe.clafer',
                regex: '\'\'' },
              { token: 'punctuation.definition.string.end.clafer',
                regex: '\'',
                next: 'pop' },
              { defaultToken: 'string.quoted.single.clafer' } ] },
          { token: 'keyword.operator',
           regex: '->>|->|[+\\-;,/*%:]|:=|=|\\.|->' },
          { token: 'keyword.optional',
           regex: '\\?' },
          { token: 'keyword.constraint',
           regex: '\\[|\\]' },
          { token: 'keyword.operator.logical',
           regex: '&&|\\|\\||!' },
          { token: 'keyword.goal',
           regex: '<<|>>' } ] }
    
    this.normalizeRules();
};

oop.inherits(ClaferHighlightRules, TextHighlightRules);

exports.ClaferHighlightRules = ClaferHighlightRules;
});
