var streams2 = require('./streams2');
var streams3 = require('./streams3');
var streams4 = require('./streams4');
var streams5 = require('./streams5');

var getCoreDetails = streams5.getCoreDetails;
var getCoreFolders = streams5.getCoreFolders;
var getFilePath = streams5.getFilePath;
var getModuleDetails = streams4.getModuleDetails;
var getModuleFolders = streams3.getModuleFolders;
var getPluginDetails = streams5.getPluginDetails;
var isFile = streams2.isFile;

function createProject(portalSourceFolder, otherSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var coreFolders = getCoreFolders();

	var includeSubRepos = true;
	var moduleFolders = [];
	var pluginFolders = [];

	for (var i = 0; i < otherSourceFolders.length; i++) {
		var otherSourceFolder = otherSourceFolders[i];

		if (isPluginsSDK(otherSourceFolder)) {
			var newFolders = getPluginFolders(portalSourceFolder, otherSourceFolder);

			pluginFolders = pluginFolders.concat(newFolders);
		}
		else {
			includeSubRepos &= isBladeWorkspace(otherSourceFolder);

			var newFolders = getModuleFolders(portalSourceFolder, otherSourceFolder, true);

			moduleFolders = moduleFolders.concat(newFolders);
		}
	}

	//var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules/apps/marketplace');

	var newFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath, includeSubRepos);

	moduleFolders = moduleFolders.concat(newFolders);

	var coreDetails = coreFolders.map(getCoreDetails);
	var moduleDetails = moduleFolders.map(getModuleDetails);
	var pluginDetails = pluginFolders.map(getPluginDetails);

	console.dir(coreDetails, {depth: null});
	//console.dir(moduleDetails, {depth: null});

	process.chdir(initialCWD);
};

function isBladeWorkspace(otherSourceFolder) {
	return isFile(getFilePath(otherSourceFolder, 'gradle.properties'));
};

function isPluginsSDK(otherSourceFolder) {
	return isFile(getFilePath(otherSourceFolder, 'build-common-plugins.xml'));
};

exports.createProject = createProject;