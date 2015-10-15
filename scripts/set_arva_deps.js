/**
 * Created by tom on 15/10/15.
 */
var exec = require('child_process').exec;
function puts(error, stdout, stderr) { sys.puts(stdout) }

var arvaDependencies = [
    'arva-ds',
    'arva-utils'
];


var version = process.argv[3];
if(!version) {
    console.log('No version to set arva dependencies to was given. \r\n' +
        'Example usage: `node scripts/set_arva_deps.js -- master` to set arva dependencies to @master');
    process.exit(1);
}

(function installDependency(){
    var dependency = arvaDependencies.shift();
    if(!dependency) { return; }

    exec(`jspm install ${dependency}=github:bizboard/${dependency}@${version}`, function(error, stdoutText, stderrText) {
        console.log(stdoutText);
        if(error){
            console.log('Error whilst installing dependency:', error);
        }
        installDependency();
    });
})();