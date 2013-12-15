/*
Copyright (C) 2012 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

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

function CompiledFormats(host, settings)
{ 
    this.id = "mdCompiledFormats";
    this.settings = settings;

    this.title = this.settings.title;

    this.width = this.settings.layout.width;
    this.height = this.settings.layout.height;
    this.posx = this.settings.layout.posx;
    this.posy = this.settings.layout.posy;

    this.ajaxUrl = "/htmlwrapper";
    
    this.host = host;
    this.goals = null;
    this.compiled_formats = [];
    this.docLoadCounter = 0;
    this.docLoadCount = 0;

    this.saveFormatBasicQuery = "/saveformat?windowKey=" + this.host.key + "&fileid=";
}

CompiledFormats.method("onDocLoad", function(){
    this.docLoadCounter = this.docLoadCounter + 1;
    if (this.docLoadCounter == this.docLoadCount) // all iframes are reloaded
    {
        for (var i = 0; i < this.compiled_formats.length; i++)
        {
            if (this.compiled_formats[i].displayElement == "iframe")
            {
                var iframe = $("#" + this.compiled_formats[i].id + "_format")[0];

                if (iframe.contentWindow)
                    iframe.contentWindow.document.write(this.compiled_formats[i].result);
                else
                    iframe.document.write(this.compiled_formats[i].result);
            }
        }
    }
});

CompiledFormats.method("getInitContent", function()
{
    var result = "";
    result += '<div style="height:100%;overflow:hidden">';

    result += '<table width="100%" height="100%" cellspacing="0" cellpadding="0">';    
    result += '<tr height="1em"><td style="padding: 0px 2px 2px 5px"><span>Show:</span><select id="formats" title="Select a format to show">';   
    result += '</select></td><td>';   

    if (this.settings.allow_downloading)
    {
        result += '<a id="saveFormat" href="" target="_blank">Download</a>';
    }

    result += '</td></tr><tr height="100%"><td colspan="2" style="border-top: 2px groove threedface; height:100%">';    
    result += '<div id="format_views" style="height:100%;overflow:hidden;padding:0px 5px 5px 0px">';
    result += '</td></tr></table></div>';


    return result;

});

CompiledFormats.method("onInitRendered", function()
{
    $("#formats")[0].onchange = this.onFormatChange.bind(this);        

    var height = (this.height - 35);
    var width = (this.width - 5);

    var ajaxUrl = this.ajaxUrl;
    var context = this;

    $.getJSON('/Formats/formats.json', 
        function(data)
        {
            var formats = data.formats;
            var options = "";
            var views = "";
        
            var counter = 0; // need this, because not all formats are displayable

            for (var i = 0; i < formats.length; i++)
            {
                if (formats[i].display_element == "none") // invisible in the view
                {
                    continue;
                }

                if (counter == 0)
                {
                    style = "display:block;";
                    context.adjustSaveFormat(formats[i].id);
                }
                else
                {
                    style = "display:none;";                    
                }

                style += 'border:0;';

                options += '<option value="' + formats[i].id + '" title="' + formats[i].tooltip + '">' + formats[i].label + '</option>';
                
                if (formats[i].display_element == "iframe") // all iframes have to be put in advance
                {
                    views += '<iframe id="' + formats[i].id + '_format" style="' + style + '" scrolling="yes" height = "' + '100%' + '" src="' + ajaxUrl + '" frameborder="0" width="' + '100%' + '"></iframe>';
                }
//                else if (formats[i].display_element == "xml") // TODO: customize for XML
//                {
//                    style += 'width: ' + '100%' + '; height: ' + '100%' + ';' + 'white-space: nowrap; overflow: auto; resize: none;';
//                    views += '<textarea readonly="readonly" id="' + formats[i].id + '_format" height = "' + '100%' + '" width="' + '100%' + '" style="' + style + '"></textarea>';
//                }
                else // textarea
                {
                    style += 'width: ' + '100%' + '; height: ' + '100%' + ';' + 'white-space: nowrap; overflow: auto; resize: none;';
                    views += '<textarea readonly="readonly" id="' + formats[i].id + '_format" height = "' + '100%' + '" width="' + '100%' + '" style="' + style + '"></textarea>';
                }

                counter++;
            }
            
            $("#formats").html(options);
            $("#format_views textarea").remove();
            $("#format_views").append(views);

            var iframes = $("#format_views iframe");

            for (var i = 0; i < iframes.length; i++)
            {
                iframes[i].onload = context.onDocLoad.bind(context); 
            }

        }
    ).error(function() 
        { 
            var options = '<option value="">(Could not load formats)</option>';
            $("#formats").html(options);

        });

});

CompiledFormats.method("setResult", function(data){

    // resetting
    this.compiled_formats = [];
    this.docLoadCounter = 0;
    this.docLoadCount = 0;
    this.compiled_formats = data; // save the results

    for (var i = 0; i < data.length; i++)
    {
        if (data[i].displayElement == "iframe")
        {
            this.docLoadCount = this.docLoadCount + 1;
            // to iframe : reload, and then put whatever we need
            $("#" + data[i].id + "_format")[0].src = $("#" + data[i].id + "_format")[0].src; // reloading
        }
        else if (data[i].displayElement == "xml") // to XML Display
        {
            $("#" + data[i].id + "_format").val(data[i].result); 
        }
        else if (data[i].displayElement == "download_only") // only for download
        {
            $("#" + data[i].id + "_format").val("For download only"); 
        }        
        else // to textarea: copy directly
        {
            $("#" + data[i].id + "_format").val(data[i].result); 
        }            
    }
});

CompiledFormats.method("adjustSaveFormat", function(id)
{
    $("#saveFormat").attr("href", this.saveFormatBasicQuery + id);
});

CompiledFormats.method("onFormatChange", function()
{
    $("#format_views").children().each(function(){
        this.style.display = "none";
    });

    $("#format_views").children("#" + $( "#formats option:selected" ).val() + "_format")[0].style.display = "block";
    this.adjustSaveFormat($( "#formats option:selected" ).val());

});
