var fs = require('fs');
var highland = require('highland');
var streams2 = require('../streams2/streams2');
var streams3 = require('../streams4/streams3');
var streams4 = require('../streams5/streams4');
var streams5 = require('../streams6/streams5');
var streams7 = require('../streams8/streams7');
var streams8 = require('../streams9/streams8');
var streams0 = require('./streams0');

var createProjectObjectModels = streams0.createProjectObjectModels;
var createProjectWorkspace = streams0.createProjectWorkspace;
var flatten = streams0.flatten;
var getAncestorFiles = streams7.getAncestorFiles;
var getCoreDetails = streams5.getCoreDetails;
var getCoreFolders = streams5.getCoreFolders;
var getFilePath = streams5.getFilePath;
var getModuleDetails = streams4.getModuleDetails;
var getModuleFolders = streams3.getModuleFolders;
var getPluginDetails = streams5.getPluginDetails;
var getPluginFolders = streams5.getPluginFolders;
var getPluginSDKRoot = streams5.getPluginSDKRoot;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

function createProject(portalSourceFolder, otherSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	if (!isDirectory('.idea')) {
		fs.mkdirSync('.idea');
	}

	if (isFile('.idea/jsLibraryMappings.xml')) {
		fs.unlinkSync('.idea/jsLibraryMappings.xml');
	}

	if (!isDirectory('.idea/libraries')) {
		fs.mkdirSync('.idea/libraries');
	}

	var coreFolders = getCoreFolders();

	var moduleFolders = [];
	var pluginFolders = [];

	for (var i = 0; i < otherSourceFolders.length; i++) {
		var sourceRoots = getSourceRoots(otherSourceFolders[i]);

		if (sourceRoots.length == 0) {
			sourceRoots = [otherSourceFolders[i]];
		}

		for (var j = 0; j < sourceRoots.length; j++) {
			var sourceRoot = sourceRoots[j];

			console.log('Scanning ' + sourceRoot);

			if (isPluginsSDK(sourceRoot)) {
				var newFolders = getPluginFolders(portalSourceFolder, sourceRoot);

				pluginFolders = pluginFolders.concat(newFolders);
			}
			else {
				var modulesPrivatePath = getFilePath(sourceRoot, 'modules/private');

				if (isDirectory(modulesPrivatePath)) {
					sourceRoot = modulesPrivatePath;
				}

				var newFolders = getModuleFolders(portalSourceFolder, sourceRoot);

				moduleFolders = moduleFolders.concat(newFolders);
			}
		}
	}

	console.log('Scanning ' + portalSourceFolder);

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var coreModuleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	var coreDetails = coreFolders.map(getCoreDetails);
	var moduleDetails = moduleFolders.map(getModuleDetails);

	var moduleNames = new Set(moduleDetails.map(getModuleName));

	var coreModuleDetails = coreModuleFolders
		.map(getModuleDetails)
		.filter(highland.compose(highland.not, Set.prototype.has.bind(moduleNames), getModuleName));

	var pluginDetails = pluginFolders.map(getPluginDetails);

	createProjectWorkspace(coreDetails, moduleDetails.concat(coreModuleDetails), pluginDetails);

	process.chdir(initialCWD);
};

function getModuleName(module) {
	return module.moduleName;
};

function getSourceRoots(folderPath) {
	var gitRoots = getAncestorFiles(folderPath, '.git');

	if (gitRoots.length > 0) {
		return [folderPath];
	}

	var fileNames = fs.readdirSync(folderPath);
	var filePaths = fileNames.map(getFilePath.bind(null, folderPath));
	var directoryPaths = filePaths.filter(isDirectory);

	return directoryPaths.map(getSourceRoots).reduce(flatten, []);
};

function isPluginsSDK(otherSourceFolder) {
	return getPluginSDKRoot(otherSourceFolder) != null;
};

function prepareProject(portalSourceFolder, otherSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var coreFolders = getCoreFolders();

	var moduleFolders = [];

	for (var i = 0; i < otherSourceFolders.length; i++) {
		var sourceRoots = getSourceRoots(otherSourceFolders[i]);

		if (sourceRoots.length == 0) {
			sourceRoots = [otherSourceFolders[i]];
		}

		for (var j = 0; j < sourceRoots.length; j++) {
			var sourceRoot = sourceRoots[j];

			console.log('Scanning ' + sourceRoot);

			if (!isPluginsSDK(otherSourceFolder)) {
				var newFolders = getModuleFolders(portalSourceFolder, otherSourceFolder);

				moduleFolders = moduleFolders.concat(newFolders);
			}
		}
	}

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var coreModuleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	var coreDetails = coreFolders.map(getCoreDetails);
	var moduleDetails = moduleFolders.map(getModuleDetails);

	var moduleNames = new Set(moduleDetails.map(getModuleName));

	var coreModuleDetails = coreModuleFolders
		.map(getModuleDetails)
		.filter(highland.compose(highland.not, Set.prototype.has.bind(moduleNames), getModuleName));

	createProjectObjectModels(coreDetails, moduleDetails.concat(coreModuleDetails));

	process.chdir(initialCWD);
};

exports.createProject = createProject;
exports.prepareProject = prepareProject;