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

    this.width = (window.parent.innerWidth-30) / 4;
    this.height = window.parent.innerHeight-190;
    this.posx = (window.parent.innerWidth-30) * 3 / 4;
    this.posy = 140;
    this.host = host;
    this.content = "";
}

Output.method("getInitContent", function(){
    return '<textarea id="output" readonly="readonly" style="width:95%;height:95%;border:0" border="0"></textarea>';
});

Output.method("onDataLoaded", function(data){
//    if (data.consoleOut)
//        this.content += data.consoleOut;
});

Output.method("onRendered", function(){
//    $("#mdOutput .window-content").scrollTop($("#mdOutput #output").height());
});

Output.method("onInitRendered", function(){
//    $('#myform').submit();
});