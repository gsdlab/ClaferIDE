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

function Output(host, settings)
{ 
    this.id = "mdOutput";
    this.settings = settings;
    this.title = this.settings.title;

    this.width = this.settings.layout.width;
    this.height = this.settings.layout.height;
    this.posx = this.settings.layout.posx;
    this.posy = this.settings.layout.posy;

    this.host = host;
    this.content = "";

    this.editor = null;

    this.resize = this.onResize.bind(this);     
}

Output.method("onResize", function() {
    this.editor.resize();
});

Output.method("getInitContent", function(){
	var result = "";

    result += '<div style="height:100%;overflow:hidden">';
    result += '<table cellspacing="0" width="100%" height="100%" cellpadding="0">';
    result += '<tr height="1em"><td style="border-bottom: 2px groove threedface"><button id="clearOutput">Clear output</button></td></tr>';
    result += '<tr height="100%"><td style="height:100%">';
//    result += '<div style="display:inline-block;height:100%;">';
    result += '<div style="height:100%; width:100%" name="clafer_editor" id="console_editor">';
//    result += '</div>';
    result += '</div>';
    result += '</td></tr>';
    result += '</table>';
    result += '</div>';
    return result;
});

Output.method("appendConsole", function(text){
    this.editor.setValue(this.editor.getValue() + text);

	var count = this.editor.getSession().getLength();
	//Go to end of the last line
	this.editor.gotoLine(count, this.editor.getSession().getLine(count - 1).length);

});

Output.method("onClearClick", function(){
    if (confirm("Are you sure you want to clear the output window?"))
    {
        this.editor.setValue("");
    }
});

Output.method("onInitRendered", function(){
    this.editor = ace.edit("console_editor");
    this.editor.setTheme("ace/theme/terminal");
    this.editor.getSession().setMode("ace/mode/console");
    this.editor.setShowPrintMargin(false);

    $("#clearOutput")[0].onclick = this.onClearClick.bind(this);

	this.editor.getSession().setUseWrapMode(false);   
	this.editor.setReadOnly(true); 
	this.editor.setHighlightActiveLine(false);	 
	this.editor.renderer.setShowGutter(false);
});