module.exports = function(grunt) {

    // Grunt config
    grunt.initConfig({
      pkg : grunt.file.readJSON('package.json'),

      watch : {
        html : {
          files : ['*.html'],
          options : {
            livereload : true,
          },
        },
        scripts : {
          files : ['src/j/*.js'],
          options : {
            spawn : false,
            livereload : true,
            tasks: ['uglify']
          },
        },
      },
      uglify: {
        my_target: {
          files: {
            'build/j/webgl.beer.min.js': ['src/webgl.beer.js']
          }
        }
      }
    });

    // Load tasks
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Register tasks
    grunt.registerTask('default', ['watch']);

};