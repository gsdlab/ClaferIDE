##### ClaferIDE Version 0.5.8, unreleased

Minor release with Clafer 0.5.8.

* The example `Counter.cfr` counts from 1 to 5 and starts over: a reference with an initial value, `counter -> integer := 1`, and a chain of transitions, with a single rule for every value as an alternative.

##### ClaferIDE Version 0.5.7, Nov 8, 2026

Minor release with Clafer 0.5.7.

* TL button for the Alloy backend, next to Check: sets the maximum length of the traces of a dynamic model (by default 10 states) and solves again; checks use it too.
* The scrollbar of the Output console shows on its black background, and the mouse wheel scrolls it by a few lines instead of about a page.
* Next Config, Next and Fork on large dynamic models no longer fill the server's temporary folder (ClaferIG 0.5.7).
* The example `CoffeeMachine.cfr` gives `brewing` its second way out as a constraint in the state, `[ this -[ no milk ]->> ready ]`, which lasts as long as the state's own transition.
* The client libraries jQuery, jQuery Form, d3, lodash and Chosen are npm dependencies in `package.json`, served from `node_modules` (ClaferToolsUICommonPlatform), so that `npm audit` and Dependabot report their vulnerabilities; they were copies in the commons. Chosen is upgraded from 1.0.0 to 1.8.7, and the HTML5 placeholder shim for old browsers is removed.
* The client code no longer uses jQuery APIs deprecated in jQuery 3 (`.bind`, `.unbind`, `.delegate`, `.hover` and event shorthands such as `.click()`), a step towards jQuery 4.
* multer 2.5.0 and body-parser 1.20.9 (of express) fix denial-of-service advisories of the server.
* The editor is Ace 1.45.2, an npm dependency like the other client libraries, instead of a copy of Ace 1.1 from 2013 in the commons; the Clafer and console highlighting modes are ported to it.
* The server runs on Express 5.3 (was 4.22), whose support continues, and express-rate-limit 8.7.3.
* jQuery 4.0.0 (was 3.7.1). The forms are sent with $.ajax and FormData instead of the unmaintained jQuery Form plugin, and the clafers of the model are suggestions of the field Clafer name(s) of the custom scope (a datalist) instead of the drop-down of the unmaintained Chosen plugin; choosing one fills in its scope.
* The editor highlights Clafer like the VS Code extension: the temporal keywords (`always`, `eventually`, `until`, `initially`, `never`, ...), `initial`, `final`, `assert`, `enum`, `if`/`then`/`else`, `parent`, `dref` and the transition arrows. Braces `{ }` were shown as comments and apostrophes in names (`x'`) as strings, and keywords were case-insensitive.
* The client code uses the browser's own array functions and optional chaining instead of lodash, which is no longer a dependency.
* `npm test` runs the tests of the commons, `commons/test`, in a page simulated by jsdom, a development dependency that the deployment (`npm ci --omit=dev`) leaves out: the Feature and Quality Matrix does not select a variant that is removed, and the clafers are shown by their UIDs as they are.

##### ClaferIDE Version 0.5.6, Nov 1, 2026

Minor release with Clafer 0.5.6.

* New example: a coffee machine with temporal behaviour, in three modeling styles.
* Temporal models run on the Alloy-based instance generator.
* Check button for the Alloy backend: checks the assertions of the model, or those on the given line, and shows a counterexample of each one that fails.
* Diff, Fork and Next Config buttons for the Alloy backend: the changes between instances or states, another trace from a chosen state of a dynamic model, and a trace with another configuration.
* The Diff button can be set before running, and is on by default.
* The view Compiled Formats is now Results: it can show a Solution Graph, which it switches to when a run starts: the latest instance, or the states and transitions of the latest trace (Graphviz), with the changes of each state when Diff is on.
* The tool speaks of a solution generator and solutions, which are instances or traces. The formats' Graph is now Model Graph, which shows the graph instead of its Graphviz source, still available by Download, and the help of the generator lists its buttons.
* The help pages are shown with their styles, images and the title and version of the tool: their paths broke when the tool moved to relative URLs in 0.5.5.

##### ClaferIDE Version 0.5.5, Oct 27, 2026

Minor release with Clafer 0.5.5.

* Models can use decimals, a new primitive type `decimal` with a fixed number of fractional digits, for the Choco-based instance generator (Clafer 0.5.5), e.g., `cost -> decimal = 19.99`; the editor highlights `decimal`. The Alloy-based instance generator shows why it cannot run such a model (ClaferIG 0.5.5).
* Example `Bike.cfr`: a bike with decimal costs and weights.
* The Choco-based backend is described as Choco 6 (chocosolver 0.5.5 uses choco-solver 6.0.2).
* The buttons **URL** and **import** next to the example selector copy the URL of the selected example, to import it into a model elsewhere, and the line `//# OPTIONS --import=Examples/<file>.cfr`, for a model in this tool. Nothing showed the URL of an example. The welcome window, the help and the README explain them.
* The tool can be served under a path behind a reverse proxy, e.g., `https://wiselab.uwaterloo.ca/claferide/` instead of the port 8094, since its pages and requests use relative URLs (ClaferToolsUICommonPlatform). The live demo link points there.

##### ClaferIDE Version 0.5.4, Oct 25, 2026

Minor release with Clafer 0.5.4.

* Models can import other models with `//# OPTIONS --import=...` ([gsdlab/clafer#100](https://github.com/gsdlab/clafer/issues/100)). Since a submitted model may come from anyone, its imports are restricted: only `.cfr` files, local files only from the tool's `Examples` folder (`--import=Examples/<file>.cfr`), and URLs only from public addresses. A model opened with `?claferFileURL=` imports relative to its URL.
* Messages give positions as `model.cfr:line:column` and no longer show the server's folders.
* The welcome window can be closed again: with jQuery 3, its gray backdrop stayed over the page.
* The live demo and model wiki links point to wiselab.uwaterloo.ca.
* [Release](https://github.com/gsdlab/ClaferIDE/pull/19)

##### ClaferIDE Version 0.5.3, Oct 15, 2026

Minor release with Clafer 0.5.3.

* Runs on current Node.js: Express 4 instead of Express 3, with multer for the uploads; `package-lock.json` pins the dependencies.
* Reads the JSON IR of Clafer 0.5.3. Temporal models can be edited and compiled; instance generation is disabled for them, with an explanation in the output.
* The example models set their integer ranges in `//# OPTIONS` (`--minint`, `--maxint`), which silently restricted or emptied their optimal instances before.
* The Choco backend runs the `chocosolver` command from `PATH` instead of a fixed path to `chocosolver.jar`.
* Upgraded client libraries: jQuery 3.7.1, lodash 4.18.1, jquery.form 4.3.0 and d3 3.5.17.
* Hardened server: validated uploads, security headers, size and rate limits, errors without stack traces; models can be opened with `?claferFileURL=` only from the URLs in `allowedModelURLs` (or `ALLOWED_MODEL_URLS`).
* [Release](https://github.com/gsdlab/ClaferIDE/pull/18)

Earlier versions: see the repository's tags.
