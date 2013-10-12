'use strict';

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		requirejs: {
            compile: {
                // Options: https://github.com/jrburke/r.js/blob/master/build/example.build.js
                options: {
                    paths: {
                        Q: '../bower_components/q/q'
                    },
                    name: '../node_modules/almond/almond',

                    baseUrl: 'src',
                    optimize: 'none',
                    out: 'dist/LargeLocalStorage.js',
                    preserveLicenseComments: false,
                    useStrict: true,
                    wrap: true,
                    //uglify2: {} // https://github.com/mishoo/UglifyJS2
                }
            }
        }
    });
};