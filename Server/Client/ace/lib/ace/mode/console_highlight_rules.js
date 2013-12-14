
define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var ConsoleHighlightRules = function() {
    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used

    this.$rules = { start: 
       [ { caseInsensitive: true,
           token: 'keyword.control.console',
           regex: '^(?:(ClaferIDE|Compiler))\\b' },
         { caseInsensitive: true,           
           token: 
            [ 'variable.console', "text",
              'storage.type.prototype.console',
              'entity.name.function.prototype.console' ],
           regex: '\\b(function|procedure)(\\s+)(\\w+)(\\.\\w+)?(?=(?:\\(.*?\\))?;\\s*(?:attribute|forward|external))' },
         { token: 'constant.numeric.console',
           regex: '\\b((0(x|X)[0-9a-fA-F]*)|(([0-9]+\\.?[0-9]*)|(\\.[0-9]+))((e|E)(\\+|-)?[0-9]+)?)(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b' },
         ] }
    
    this.normalizeRules();
};

oop.inherits(ConsoleHighlightRules, TextHighlightRules);

exports.ConsoleHighlightRules = ConsoleHighlightRules;
});
