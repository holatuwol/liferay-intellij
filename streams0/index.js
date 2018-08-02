var fs = require('fs');
var path = require('path');
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

function createProject(portalSourceFolder, otherSourceFolders, unload) {
	scanProject(portalSourceFolder, otherSourceFolders, unload, createProjectWorkspace);
};

function getModuleName(module) {
	return module.moduleName;
};

function getModulePluginsFolders(sourceRoot, pluginFolders, getNewPluginFolders) {
	var appsPath = getFilePath(sourceRoot, 'modules/apps');

	if (isDirectory(appsPath)) {
		pluginFolders = fs.readdirSync(appsPath)
			.map(getFilePath.bind(null, appsPath))
			.filter(isDirectory)
			.map(getNewPluginFolders)
			.reduce(flatten, pluginFolders);
	}

	var privateAppsPath = getFilePath(sourceRoot, 'modules/private/apps');

	if (isDirectory(privateAppsPath)) {
		pluginFolders = fs.readdirSync(privateAppsPath)
			.map(getFilePath.bind(null, privateAppsPath))
			.filter(isDirectory)
			.map(getNewPluginFolders)
			.reduce(flatten, pluginFolders);
	}

	return pluginFolders;
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

function isPortalPreModule(folder) {
	return isFile(getFilePath(folder, '.lfrbuild-portal-pre'));
};

function prepareProject(portalSourceFolder, otherSourceFolders) {
	scanProject(portalSourceFolder, otherSourceFolders, false, createProjectObjectModels);
};

function scanProject(portalSourceFolder, otherSourceFolders, unload, callback) {
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

	var getNewPluginFolders = getPluginFolders.bind(null, portalSourceFolder);

	for (var i = 0; i < otherSourceFolders.length; i++) {
		var sourceRoots = getSourceRoots(otherSourceFolders[i]);

		if (sourceRoots.length == 0) {
			sourceRoots = [otherSourceFolders[i]];
		}

		for (var j = 0; j < sourceRoots.length; j++) {
			var sourceRoot = sourceRoots[j];

			console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning ' + sourceRoot);

			if (isPluginsSDK(sourceRoot)) {
				var newFolders = getNewPluginFolders(sourceRoot);

				pluginFolders = pluginFolders.concat(newFolders);
			}
			else {
				pluginFolders = getModulePluginsFolders(sourceRoot, pluginFolders, getNewPluginFolders);
			}

			var modulesPrivatePath = getFilePath(sourceRoot, 'modules/private');

			if (isDirectory(modulesPrivatePath)) {
				sourceRoot = modulesPrivatePath;
			}

			var newFolders = getModuleFolders(portalSourceFolder, sourceRoot);

			moduleFolders = moduleFolders.concat(newFolders);
		}
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning ' + portalSourceFolder + ' for legacy plugins');

	pluginFolders = getModulePluginsFolders(portalSourceFolder, pluginFolders, getNewPluginFolders);

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning ' + portalSourceFolder + ' for modules');

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var coreModuleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	var portalPreModules = coreModuleFolders.filter(isPortalPreModule).map(highland.ncurry(1, path.basename));

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Extracting metadata from module build files');

	var coreDetails = coreFolders.map(getCoreDetails.bind(null, portalPreModules));
	var moduleDetails = moduleFolders.map(getModuleDetails);

	var moduleNames = new Set(moduleDetails.map(getModuleName));

	var coreModuleDetails = coreModuleFolders
		.map(getModuleDetails)
		.filter(highland.compose(highland.not, Set.prototype.has.bind(moduleNames), getModuleName));

	var pluginDetails = pluginFolders.map(getPluginDetails);

	callback(coreDetails, moduleDetails.concat(coreModuleDetails), pluginDetails, unload);

	process.chdir(initialCWD);
};

exports.createProject = createProject;
exports.prepareProject = prepareProject;