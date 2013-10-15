'use strict';

module.exports = function (grunt) {
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
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
		},

		connect: {
			server: {
				options: {
					port: 9001,
					base: '.'
				}
			}
		},

		yuidoc: {
			compile: {
				name: '<%= pkg.name %>',
				description: '<%= pkg.description %>',
				version: '<%= pkg.version %>',
				url: '<%= pkg.homepage %>',
				options: {
					paths: 'src',
					themedir: '../yuidoc-bootstrap-theme',
					helpers: ['../yuidoc-bootstrap-theme/helpers/helpers.js'],
					outdir: 'doc'
			      }
			}
		}
	});

	grunt.registerTask('default', ['concat', 'connect', 'watch']);
	grunt.registerTask('docs', ['yuidoc']);
};