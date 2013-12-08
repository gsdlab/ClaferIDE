/*
Copyright (C) 2012 Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function Output(host)
{ 
    this.id = "mdOutput";
    this.title = "Output";

    this.width = (window.parent.innerWidth+45) * 0.38;
    this.height = window.parent.innerHeight-50;
    this.posx = (window.parent.innerWidth-30) * (1 - 0.38);
    this.posy = 0;
    this.host = host;
    this.content = "";

    this.editor = null;
    this.editorWidth =this.width - 5;
    this.editorHeight = this.height;    
}

Output.method("getInitContent", function(){
	var result = "";

    result += '<div style="height:' + this.editorHeight + 'px; width: ' + this.editorWidth + 'px;" name="clafer_editor" id="console_editor">';
    result += '</div>';

    return result;
});

Output.method("appendConsole", function(text){
    this.editor.setValue(this.editor.getValue() + text);

	var count = this.editor.getSession().getLength();
	//Go to end of the last line
	this.editor.gotoLine(count, this.editor.getSession().getLine(count - 1).length);

});

Output.method("onInitRendered", function(){
    this.editor = ace.edit("console_editor");
    this.editor.setTheme("ace/theme/terminal");
    this.editor.getSession().setMode("ace/mode/console");
    this.editor.setShowPrintMargin(false);

	this.editor.getSession().setUseWrapMode(false);   
	this.editor.setReadOnly(true); 
	this.editor.setHighlightActiveLine(false);	 
	this.editor.renderer.setShowGutter(false);
});