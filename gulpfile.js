'use strict';

var Cesium = require('cesium');
var child_process = require('child_process');
var fsExtra = require('fs-extra');
var gulp = require('gulp');
var eslint = require('gulp-eslint');
var Jasmine = require('jasmine');
var JasmineSpecReporter = require('jasmine-spec-reporter').SpecReporter;
var open = require('open');
var path = require('path');
var yargs = require('yargs');

var defined = Cesium.defined;
var argv = yargs.argv;

// Add third-party node module binaries to the system path
// since some tasks need to call them directly.
var environmentSeparator = process.platform === 'win32' ? ';' : ':';
var nodeBinaries = path.join(__dirname, 'node_modules', '.bin');
process.env.PATH += environmentSeparator + nodeBinaries;

var esLintFiles = ['**/*.js', '!node_modules/**', '!coverage/**', '!doc/**'];
var specFiles = ['**/*.js', '!node_modules/**', '!coverage/**', '!doc/**', '!bin/**'];

gulp.task('eslint', function () {
    var stream = gulp.src(esLintFiles)
        .pipe(eslint())
        .pipe(eslint.format());
    if (argv.failTaskOnError) {
        stream = stream.pipe(eslint.failAfterError());
    }

    return stream;
});

gulp.task('eslint-watch', function() {
    gulp.watch(esLintFiles).on('change', function(event) {
        gulp.src(event.path)
            .pipe(eslint())
            .pipe(eslint.format());
    });
});

gulp.task('test', function (done) {
    var jasmine = new Jasmine();
    jasmine.loadConfigFile('specs/jasmine.json');
    jasmine.addReporter(new JasmineSpecReporter({
        displaySuccessfulSpec: !defined(argv.suppressPassed) || !argv.suppressPassed
    }));
    jasmine.execute();
    jasmine.onComplete(function (passed) {
        done(argv.failTaskOnError && !passed ? 1 : 0);
    });
});

gulp.task('test-watch', function () {
    gulp.watch(specFiles).on('change', function () {
        // We can't simply depend on the test task because Jasmine
        // does not like being run multiple times in the same process.
        try {
            child_process.execSync('jasmine JASMINE_CONFIG_PATH=specs/jasmine.json', {
                stdio: [process.stdin, process.stdout, process.stderr]
            });
        } catch (exception) {
            console.log('Tests failed to execute.');
        }
    });
});

gulp.task('coverage', function () {
    fsExtra.removeSync('coverage/server');
    child_process.execSync('istanbul' +
        ' cover' +
        ' --include-all-sources' +
        ' --dir coverage' +
        ' -x "specs/**" -x "coverage/**" -x "doc/**" -x "bin/**" -x "index.js" -x "gulpfile.js"' +
        ' node_modules/jasmine/bin/jasmine.js' +
        ' JASMINE_CONFIG_PATH=specs/jasmine.json', {
        stdio: [process.stdin, process.stdout, process.stderr]
    });
    open('coverage/lcov-report/index.html');
});
