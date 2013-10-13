'use strict';

module.exports = function (grunt) {
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
		},

		watch: {
			scripts: {
				files: ["src/**/*.js"],
				tasks: ["concat"]
			}
		}
	});

	grunt.registerTask('default', ['concat', 'watch']);
};