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
var getPluginDetails = streams5.getPluginDetails;
var getPluginFolders = streams5.getPluginFolders;
var getPluginSDKRoot = streams5.getPluginSDKRoot;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

function createProject(portalSourceFolder, otherSourceFolders, unload) {
	scanProject(portalSourceFolder, otherSourceFolders, unload, createProjectWorkspace);
};

function getBaseFolderName(folderName) {
	var pos = folderName.indexOf('/src/');

	if (pos != -1) {
		return folderName.substring(0, pos + 4);
	}

	pos = folderName.indexOf('/docroot/');

	if (pos != -1) {
		return folderName.substring(0, pos);
	}

	return folderName;
};

function getModuleFolders(portalSourceFolder, moduleSourceFolder) {
	var lsFileCachePath = getFilePath(moduleSourceFolder, 'git_ls_files_modules.txt');

	if (!isFile(lsFileCachePath)) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning', moduleSourceFolder, 'for modules');

		return streams3.getModuleFolders(portalSourceFolder, moduleSourceFolder);
	}

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning', moduleSourceFolder, 'ls-files cache for modules');

	var moduleFileList = fs.readFileSync(lsFileCachePath).toString().split('\n');
	var moduleFileSet = new Set(moduleFileList);

	var moduleFolderSet = new Set(moduleFileList.map(path.dirname).map(getBaseFolderName));
	var moduleFolderList = [];
	moduleFolderSet.forEach(highland.ncurry(1, Array.prototype.push.bind(moduleFolderList)));

	var relativeRoot = path.dirname(moduleSourceFolder);

	if (relativeRoot.indexOf(portalSourceFolder) == 0) {
		relativeRoot = relativeRoot.substring(portalSourceFolder.length);
	}

	var newModuleFolders = moduleFolderList
		.filter(highland.ncurry(3, isModuleFolder, moduleFileSet, moduleFolderSet));

	if (relativeRoot != '') {
		newModuleFolders = newModuleFolders.map(getFilePath.bind(null, relativeRoot));
	}

	return newModuleFolders;
};

function getModuleName(module) {
	return module.moduleName;
};

function getModulePluginsFolders(portalSourceFolder, sourceRoot, pluginFolders, getNewPluginFolders) {
	var lsFileCachePath = getFilePath(sourceRoot, 'modules/git_ls_files_modules.txt');

	if (isFile(lsFileCachePath)) {
		console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning', sourceRoot, 'ls-files cache for legacy plugins');

		var moduleFileList = fs.readFileSync(lsFileCachePath).toString().split('\n');
		var moduleFileSet = new Set(moduleFileList);

		var moduleFolderSet = new Set(moduleFileList.map(path.dirname).map(getBaseFolderName));
		var moduleFolderList = [];
		moduleFolderSet.forEach(highland.ncurry(1, Array.prototype.push.bind(moduleFolderList)));

		var relativeRoot = sourceRoot;

		if (relativeRoot.indexOf(portalSourceFolder) == 0) {
			relativeRoot = relativeRoot.substring(portalSourceFolder.length);
		}

		var newPluginFolders = moduleFolderList
			.filter(highland.ncurry(3, isPluginFolder, moduleFileSet, moduleFolderSet));

		if (relativeRoot != '') {
			newPluginFolders = newPluginFolders.map(getFilePath.bind(null, relativeRoot));
		}

		pluginFolders = pluginFolders.concat(newPluginFolders);
	}
	else {
		var appsPath = getFilePath(sourceRoot, 'modules/apps');

		if (isDirectory(appsPath)) {
			console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning', appsPath, 'for legacy plugins');

			pluginFolders = fs.readdirSync(appsPath)
				.map(getFilePath.bind(null, appsPath))
				.filter(isDirectory)
				.map(getNewPluginFolders)
				.reduce(flatten, pluginFolders);
		}

		var privateAppsPath = getFilePath(sourceRoot, 'modules/private/apps');

		if (isDirectory(privateAppsPath)) {
			console.log('[' + new Date().toLocaleTimeString() + ']', 'Scanning', privateAppsPath, 'for legacy plugins');

			pluginFolders = fs.readdirSync(privateAppsPath)
				.map(getFilePath.bind(null, privateAppsPath))
				.filter(isDirectory)
				.map(getNewPluginFolders)
				.reduce(flatten, pluginFolders);
		}
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

function isModuleFolder(moduleFileSet, moduleFolderSet, folder) {
	if ((folder.indexOf('/archetype-resources') != -1) || (folder.indexOf('/gradleTest') != -1)) {
		return false;
	}

	if (!moduleFileSet.has(getFilePath(folder, 'bnd.bnd')) && !moduleFileSet.has(getFilePath(folder, 'package.json'))) {
		return false;
	}

	if (!moduleFolderSet.has(getFilePath(folder, 'src'))) {
		return false;
	}

	return true;
};

function isPluginFolder(moduleFileSet, moduleFolderSet, folder) {
	if (!moduleFileSet.has(getFilePath(folder, 'docroot/WEB-INF/liferay-plugin-package.properties')) &&
		!moduleFileSet.has(getFilePath(folder, 'src/WEB-INF/liferay-plugin-package.properties'))) {

		return false;
	}

	return true;
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

			if (isPluginsSDK(sourceRoot)) {
				var newFolders = getNewPluginFolders(sourceRoot);

				console.log('[' + new Date().toLocaleTimeString() + ']', 'Located', newFolders.length, 'legacy plugins folders in', sourceRoot);

				pluginFolders = pluginFolders.concat(newFolders);
			}
			else {
				var oldPluginFolderCount = pluginFolders.length;

				pluginFolders = getModulePluginsFolders(portalSourceFolder, sourceRoot, pluginFolders, getNewPluginFolders);

				console.log('[' + new Date().toLocaleTimeString() + ']', 'Located', pluginFolders.length - oldPluginFolderCount, 'legacy plugins folders in', sourceRoot);
			}

			var modulesPath = getFilePath(sourceRoot, 'modules');

			if (isDirectory(modulesPath)) {
				sourceRoot = modulesPath;
			}

			var newFolders = getModuleFolders(portalSourceFolder, sourceRoot);

			console.log('[' + new Date().toLocaleTimeString() + ']', 'Located', newFolders.length, 'modules folders in', sourceRoot);

			moduleFolders = moduleFolders.concat(newFolders);
		}
	}

	var oldPluginFolderCount = pluginFolders.length;

	pluginFolders = getModulePluginsFolders(portalSourceFolder, portalSourceFolder, pluginFolders, getNewPluginFolders);

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Located', pluginFolders.length - oldPluginFolderCount, 'legacy plugins folders in', portalSourceFolder);

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var coreModuleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	console.log('[' + new Date().toLocaleTimeString() + ']', 'Located', coreModuleFolders.length, 'modules folders in', portalSourceFolder);

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