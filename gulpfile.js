var gulp = require('gulp');
var mochaPhantomJS = require('gulp-mocha-phantomjs');
var mocha = require('gulp-mocha');
var watch = require('gulp-watch');
var run = require('gulp-run');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var coffeelint = require('gulp-coffeelint');
require('shelljs/global');

// browserify 
var browserify = require('browserify');
var coffeify = require("coffeeify");
var watchify = require('watchify')
var source = require('vinyl-source-stream'); // converts node streams into vinyl streams
var streamify = require('gulp-streamify'); // converts streams into buffers (legacy support for old plugins)

// css
var sass = require('gulp-ruby-sass'); // gulp-sass is also available (faster, feature-less)
var minifyCSS = require('gulp-minify-css');

// path stuff
var chmod = require('gulp-chmod');
var clean = require('gulp-rimraf');
var mkdirp = require('mkdirp');
var path = require('path');
var join = path.join;
var concat = require('gulp-concat');
var gzip = require('gulp-gzip');

// watchify
var watchify = require("watchify");
var deepcopy = require("deepcopy");

var mochaSelenium = require('gulp-mocha-selenium');

// for mocha
require('coffee-script/register');

var outputFile = "msa";
var buildDir = "build";
var browserFile = "browser.js";

var paths = {
  scripts: ['src/**/*.coffee'],
  testCoffee: ['./test/phantom/index.coffee']
};

var browserifyOptions =  {
  extensions: ['.coffee'],
  hasExports: true
};

var packageConfig = require('./package.json');

gulp.task('default', ['clean','test','lint','build', 'codo']);

gulp.task('test', ['test-mocha','test-phantom'],function () {
  return true;
});

gulp.task('build', ['css','build-browser','build-browser-min', 'build-gzip'],function () {
  return true;
});


// browserify debug
gulp.task('build-browser',['init', 'css'], function() {
  //gulp.src(outputFilePath).pipe(clean());

  var dBrowserifyOptions = deepcopy(browserifyOptions);
  dBrowserifyOptions["debug"] = true;

  var b = browserify(dBrowserifyOptions);
  makeBundle(b);
  return b.bundle()
    .pipe(source(outputFile + ".js"))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
});

// browserify min
gulp.task('build-browser-min',['init', 'css'], function() {
  var b = browserify(browserifyOptions);
  makeBundle(b);
  return b.bundle()
    .pipe(source(outputFile + ".min.js"))
    .pipe(streamify(uglify()))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
});
 
gulp.task('build-gzip-js', ['build-browser','build-browser-min'], function() {
   return gulp.src(join(buildDir, outputFile + ".min.js"))
     .pipe(gzip({append: false, gzipOptions: { level: 9 }}))
     .pipe(rename(outputFile + ".min.gz.js"))
     .pipe(gulp.dest(buildDir));
});
gulp.task('build-gzip-css', ['css'], function() {
  return gulp.src(join(buildDir, "msa.min.css"))
    .pipe(gzip({append: false, gzipOptions: { level: 9 }}))
    .pipe(rename("msa.min.gz.css"))
    .pipe(gulp.dest(buildDir));
});

gulp.task('build-gzip', ['build-gzip-js', 'build-gzip-css']);

gulp.task('build-test', function() {
  // compiles all coffee tests to one file for mocha
  gulp.src('./test/all_test.js').pipe(clean());

  var dBrowserifyOptions = deepcopy(browserifyOptions);
  dBrowserifyOptions["debug"] = true;

  var b = browserify(dBrowserifyOptions);
  b.transform(coffeify);
  b.add('./test/phantom/index.coffee', {expose: packageConfig.name});
  return b.bundle()
    .pipe(source("all_test.js"))
    .on('error', gutil.log)
    .on('error', gutil.beep)
    .pipe(gulp.dest('test'));
});

gulp.task('test-phantom', ["build-test"], function () {
  return gulp
  .src('./test/index.html')
  .pipe(mochaPhantomJS());
});

gulp.task('test-mocha', function () {
    return gulp.src('./test/mocha/**/*.coffee', {read: false})
        .pipe(mocha({reporter: 'spec',
                    ui: "qunit",
                    useColors: false,
                    compilers: "coffee:coffee-script/register"}));
});

// runs the mocha test in your browser
gulp.task('test-mocha-selenium', function () {
    return gulp.src('./test/mocha/**/*.coffee', {read: false})
        .pipe(mochaSelenium({reporter: 'spec',
                    ui: "qunit",
                    compilers: "coffee:coffee-script/register"}));
});

gulp.task('lint', function () {
    return gulp.src('./src/**/*.coffee')
        .pipe(coffeelint("coffeelint.json"))
        .pipe(coffeelint.reporter());
});


gulp.task('codo', ['init'],function () {
  run('codo src -o build/doc ').exec(); 
});


gulp.task('sass',['init'], function () {
    var opts = checkForSASS();
    opts.sourcemap = false;

    return gulp.src('./css/msa.scss')
      .pipe(sass(opts))
      //.pipe(rename('msa.css'))
      .pipe(chmod(644))
      .pipe(gulp.dest(buildDir));
});

gulp.task('css',['sass'], function () {
    if(checkForSASS() !== undefined){
      return gulp.src(join(buildDir,"msa.css"))
      .pipe(minifyCSS())
      .pipe(rename('msa.min.css'))
      .pipe(chmod(644))
      .pipe(gulp.dest(buildDir));
    } else{
    return false;
    }
});

gulp.task('watch', function() {
  var util = require('gulp-util')

  var opts = deepcopy(browserifyOptions);
  opts.debug = true;
  opts.cache = {};
  opts.packageCache = {};

  var b = browserify(opts);
  makeBundle(b);

  function rebundle(ids){
    b.bundle()
    .on("error", function(error) {
      util.log(util.colors.red("Error: "), error);
     })
    .pipe(source(outputFile + ".js"))
    .pipe(chmod(644))
    .pipe(gulp.dest(buildDir));
  }

  var watcher = watchify(b);
  watcher.on("update", rebundle)
   .on("log", function(message) {
      util.log("Refreshed:", message);
  });
  return rebundle();
});

function makeBundle(b){
  b.transform(coffeify);
  b.transform('cssify');
  b.add('./browser', {expose: packageConfig.name});
  if(packageConfig.sniper !== undefined && packageConfig.sniper.exposed !== undefined){
    for(var i=0; i<packageConfig.sniper.exposed.length; i++){
      b.require(packageConfig.sniper.exposed[i]);
    }
  }
  return b;
}

gulp.task('watch-test', function() {
   // watch coffee files
   gulp.watch(['./src/**/*.coffee', './test/**/*.coffee'], function() {
     gulp.run('test');
   });
});

// be careful when using this task.
// will remove everything in build
gulp.task('clean', function() {
  gulp.src(buildDir).pipe(clean());
  gulp.run('init');
});

// just makes sure that the build dir exists
gulp.task('init', function() {
  mkdirp(buildDir, function (err) {
    if (err) console.error(err)
  });
});

// -----------------------------------------
// SASS part

// check whether there is a way to run SASS
function checkForSASS(){
  if (exec('sass --help 2> /dev/null',{silent:true}).code !== 0) {
    var checkBundle = checkBundleExec();
    if( checkBundle !== undefined){
      return checkBundle;
    }else{
      echo('Error: No SASS installed. Trying to fix. You will need bundler to proceed.');
      installBundle();
      return checkBundleExec();
    }
  }
  return {};
}

function checkBundleExec(){
    if (exec('bundle exec sass --help',{silent:true}).code === 0) {
      return { bundleExec: true };
    } else {
      return undefined;
    }
}

function installBundle(){
    if(exec("bundle install --path .gems").code !== 0){
      echo('Install ruby and bundle');
      return false;
    } 
    return true;
}
