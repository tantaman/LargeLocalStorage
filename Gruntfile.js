'use strict';

module.exports = function (grunt) {
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				seperator: ';'
			},
			scripts: {
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
			},
			contrib: {
				files: ["src/contrib/**/*.js"],
				tasks: ["copy:contrib"]
			}
		},

		copy: {
			contrib: {
				files: [{expand: true, cwd: "src/contrib/", src: "**", dest: "dist/contrib/"}]
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

		// docview: {
		// 	compile: {
		// 		files: {
		// 			"doc/LargeLocalStorage.html": "doc/library.handlebars"
		// 		}
		// 	}
		// },

		yuidoc: {
			compile: {
				name: '<%= pkg.name %>',
				description: '<%= pkg.description %>',
				version: '<%= pkg.version %>',
				url: '<%= pkg.homepage %>',
				options: {
					paths: 'src',
					themedir: 'node_modules/yuidoc-library-theme',
					helpers: ['node_modules/yuidoc-library-theme/helpers/helpers.js'],
					outdir: 'doc',
					// parseOnly: true
			      }
			}
		}
	});

	grunt.registerTask('default', ['concat', 'copy', 'connect', 'watch']);
	grunt.registerTask('docs', ['yuidoc']);
};
