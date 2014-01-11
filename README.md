ClaferIDE
===================

v0.3.5.15-01-2014

A web-based IDE for Clafer.

ClaferIDE is part of Clafer Tools. 
Read more in the paper [Clafer Tools for Product Line Engineering](http://gsd.uwaterloo.ca/publications/view/519).

### Live demo

[Try me!](http://t3-necsis.cs.uwaterloo.ca:8094/)

If the demo is down or you encounter a bug, please email [Michal Antkiewicz](mailto:mantkiew@gsd.uwaterloo.ca).

### Background

[Clafer](http://clafer.org) is a general-purpose lightweight structural modeling language developed at [GSD Lab](http://gsd.uwaterloo.ca/), [University of Waterloo](http://uwaterloo.ca). 
Clafer can be used for *product-line modeling* and *multi-objective optimization*, whereby a the model of a product line can be used to find optimal products given a set of optimization goals. 

### Functions

1. Provides a web-based IDE for modeling in Clafer
2. Provides an source code editor (ACE)
2. Compiles the model to HTML for syntax highlighting and navigation via hyperlinks or error highlighting
3. Instantiates the model using ClaferIG and allows for global scope setting and requesting a next instance
4. Provides a set of predefined examples that can be compiler and instantiated

### Nature

ClaferIDE is a web-based application. 
Its server side (implemented with Node.JS) processes requests, runs the chosen back-end and passes back its output.
The client-side is implemented using Javascript/HTML and handles all the visualization and exploration functionality.

Contributors
------------

* [Alexandr Murashkin](http://gsd.uwaterloo.ca/amurashk), MMath Candidate. Main developer.
* [Michał Antkiewicz](http://gsd.uwaterloo.ca/mantkiew), Research Engineer. Requirements, development, architecture, testing, technology transfer.

Getting Clafer Tools
--------------------

Getting Clafer Tools
--------------------

Binary distributions of the release 0.3.5 of Clafer Tools for Windows, Mac, and Linux, 
can be downloaded from [Clafer Tools - Binary Distributions](http://http://gsd.uwaterloo.ca/clafer-tools-binary-distributions). 
Clafer Wiki requires Haskell Platform and MinGW to run on Windows. 

In case these binaries do not work on your particular machine configuration, the tools can be built from source code, as described below.

### Dependencies for running

* [Java Platform (JDK)](http://www.oracle.com/technetwork/java/javase/downloads/index.html) v6+, 32bit
* [Clafer](https://github.com/gsdlab/clafer) v0.3.5
  * can be from the binary distribution
* [ClaferIG](https://github.com/gsdlab/claferIG) v0.3.5
* [Node.JS Framework](http://nodejs.org/download/), v0.10.18
* [ACE](http://ace.c9.io/) Editor

### Installation

Core
--------------------

1. Download [ClaferIDE](https://github.com/gsdlab/claferIDE) to some directory `<target directory>`
2. Go to `<target directory>/ClaferIDE/Server` and execute
	
 `npm install`

3. Install the ACE source code editor.

* Clone [ace-builds](https://github.com/ajaxorg/ace-builds/) to some directory `<temp>`
  * execute `git clone https://github.com/ajaxorg/ace-builds.git`
* copy the `ace-builds/src-nonconflict` folder to `<target directory>/ClaferIDE/Server/Client/ace-builds`

### Important: Branches must correspond

Clafer, ClaferIG, ClaferIDE, ClaferWiki, ClaferMoo,  ClaferMooVisualizer, and ClaferConfigurator are following the *simultaneous release model*. 
The branch `master` contains releases, whereas the branch `develop` contains code under development. 
When building the tools, the branches should match:
Releases `clafer/master` and `claferIG/master` are guaranteed to work well together.
Development versions `clafer/develop` and `claferIG/develop` should work well together but this might not always be the case.

### Settings

1. Make sure the port `8094` is free, or change the value of the key `port` in `Server/config.json`:
`"port" = "8094"` to any free one. 

2. Make sure `clafer`, `claferIG`, `node`, and `java` are in `PATH` environment variables, so they can be executed without any path prefixes.

Running the following commands should produce the following results or later version:

`clafer -V` 

> `Clafer v0.3.5.15-01-2014`

`claferIG -V` 

> `Clafer v0.3.5.15-01-2014`

`java -version`

> `java version 1.7.0_25`

`node -v`

>v0.10.20

3. Make sure `uploads` folder is accessible for writing, since temporary files will be stored there.

### Running

To run the server execute
	
`node server.js`
 
from `<target directory>/ClaferIDE/Server/`

Then you can go to any browser and type `http://localhost:[port]/` and open any Clafer file with objectives in it.

Need help?
==========
* See [language's website](http://clafer.org) for news, technical reports and more
  * Check out a [Clafer tutorial](http://t3-necsis.cs.uwaterloo.ca:8091/Tutorial/Intro)
  * Try a live instance of [ClaferWiki](http://t3-necsis.cs.uwaterloo.ca:8091)
  * Try a live instance of [ClaferIDE](http://t3-necsis.cs.uwaterloo.ca:8094)
  * Try a live instance of [ClaferConfigurator](http://t3-necsis.cs.uwaterloo.ca:8093)
  * Try a live instance of [ClaferMooVisualizer](http://t3-necsis.cs.uwaterloo.ca:8092)
* Take a look at (incomplete) [Clafer wiki](https://github.com/gsdlab/clafer/wiki)
* Browse example models in the [test suite](https://github.com/gsdlab/clafer/tree/master/test/positive) and [MOO examples](https://github.com/gsdlab/clafer/tree/master/spl_configurator/dataset)
* Post questions, report bugs, suggest improvements [GSD Lab Bug Tracker](http://gsd.uwaterloo.ca:8888/questions/). Tag your entries with `clafermooviz` (so that we know what they are related to) and with `alexander-murashkin` or `michal` (so that Alex or Michał gets a notification).
