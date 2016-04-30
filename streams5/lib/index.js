var streams4 = require('./streams4');
var streams5 = require('./streams5');

var getCoreDetails = streams5.getCoreDetails;
var getCoreFolders = streams5.getCoreFolders;
var getModuleDetails = streams4.getModuleDetails;
var getModuleFolders = streams4.getModuleFolders;

function createProject(portalSourceFolder, pluginSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var coreFolders = getCoreFolders();
	//var moduleFolders = getModuleFolders('modules', 5);
	var moduleFolders = getModuleFolders('modules/apps/marketplace', 3);

	var coreDetails = coreFolders.map(getCoreDetails);
	var moduleDetails = moduleFolders.map(getModuleDetails);

	console.dir(coreDetails, {depth: null});
	//console.dir(moduleDetails, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;