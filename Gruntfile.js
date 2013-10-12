'use strict';

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		concat: {
            options: {
                seperator: ';'
            },
            dist: {
                src: ['src/header.js',
                      'src/impls/utils.js',
                      'src/impls/FilesystemAPIProvider.js',
                      'src/impls/IndexedDBProvider.js',
                      'src/impls/LocalStorageProvider.js',
                      'src/impls/WebSQLProvider.js',
                      'src/LargeLocalStorage.js',
                      'src/footer.js'],
                dest: 'dist/LargeLocalStorage.js'
            }
        }
    });
};