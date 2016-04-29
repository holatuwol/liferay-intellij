var streams2 = require('./streams2');

var getModuleFolders = streams2.getModuleFolders;

function createProject(workspaceFolder) {
	var initialCWD = process.cwd();

	process.chdir(workspaceFolder);

	var moduleFolders = getModuleFolders('modules', 5);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;