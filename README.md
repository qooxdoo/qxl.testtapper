# Qooxdoo TAP Testrunner

The is a TAP testrunner for Qooxdoo.

## Online Demo

http://www.qooxdoo.org/qxl.testtapper/

## Adding an testrunnner to your own code
```
$ qx contrib update
$ qx contrib install qooxdoo/qxl.testtapper
$ echo 10 > .nvmrc
$ npm i puppeteer yargs
$ qx serve
```

Then browse to [http://localhost:8080](http://localhost:8080).  You will see that you now have a new application listed, the "Qooxdoo testTAPper", that you can click on the link to run. The output of the application may be a bit underwhelming ... have a look at the debug console to see the action.

If you want to run the tests from the command line you need a headless browser to run the tests. TestTAPper uses the puppeteer node module which comes with a built in copy of headless chrome and is thus very simple to use

```
$ node source-output/resource/qxl/testtapper/run.js http://localhost:8080
```

if you start `run.js` without arguments it ouputs a little help

## Developing API Viewer
Clone this repo and compile it:

```
    $ git clone https://github.com/qooxdoo/qxl.testtapper
    $ cd qxl.testtapper
    $ qx serve
```
Then open [http://localhost:8080](http://localhost:8080)
