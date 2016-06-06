var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('./streams2');
var streams3 = require('./streams3');
var streams4 = require('./streams4');
var util = require('util');

var sourceFolders = ['src'];
var resourceFolders = [];
var testSourceFolders = ['test/unit', 'test/integration'];
var testResourceFolders = [];
var webrootFolders = ['docroot'];

var getFilePath = highland.ncurry(2, streams2.getFilePath);
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

var getDependenciesWithStreams = streams4.getDependenciesWithStreams;
var getFolders = streams3.getFolders;
var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;
var getModuleOverview = streams3.getModuleOverview;
var isValidSourcePath = streams3.isValidSourcePath;

var getLibraryDependency = highland.partial(getCoreDependency, 'library');
var getProjectDependency = highland.partial(getCoreDependency, 'project');

var defaultDependencyNames = {
	libraryNames: ['development', 'global'],
	projectNames: ['portal-kernel', 'portal-service', 'registry-api']
};

var customDependencyNames = {
	'portal-impl': {
		libraryNames: ['development', 'global', 'portal'],
		projectNames: ['portal-kernel', 'portal-service', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	},
	'portal-kernel': {
		libraryNames: ['development', 'global'],
		projectNames: ['registry-api']
	},
	'portal-service': {
		libraryNames: ['development', 'global'],
		projectNames: ['registry-api']
	},
	'portal-web': {
		libraryNames: ['development', 'global', 'portal'],
		projectNames: ['portal-impl', 'portal-kernel', 'portal-service', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	}
};

function getCoreDependency(dependencyType, dependencyName) {
	return {
		type: dependencyType,
		name: dependencyName
	};
};

function getCoreDependencies(folder) {
	var dependencyNames = defaultDependencyNames;

	if (folder in customDependencyNames) {
		dependencyNames = customDependencyNames[folder];
	}

	return {
		libraryDependencies: dependencyNames.libraryNames.map(getLibraryDependency),
		projectDependencies: dependencyNames.projectNames.filter(isModuleDependencyAvailable).map(getProjectDependency)
	};
};

function getCoreDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getCoreIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(moduleIncludeFolders);
	var moduleDependencies = getCoreDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

function getCoreFolders() {
	var findResultFolders = getFolders('.', 0);
	var coreFolders = findResultFolders.filter(isCoreFolder);
	return coreFolders;
};

function getCoreIncludeFolders(folder) {
	var isValidSourceFolder = isValidSourcePath.bind(null, folder);

	var moduleIncludeFolders = {
		sourceFolders: sourceFolders.filter(isValidSourceFolder),
		resourceFolders: resourceFolders.filter(isValidSourceFolder),
		testSourceFolders: testSourceFolders.filter(isValidSourceFolder),
		testResourceFolders: testResourceFolders.filter(isValidSourceFolder),
		webrootFolders: webrootFolders.filter(isValidSourceFolder)
	};

	return moduleIncludeFolders;
};

function getIvyDependencies(folder) {
	var ivyXmlPath = getFilePath(folder, 'ivy.xml');

	if (!isFile(ivyXmlPath)) {
		return [];
	}

	var ivyXmlContents = fs.readFileSync(ivyXmlPath);

	var dependencyTextRegex = /<dependencies ([\s\S]*)<\/dependencies>/g;
	var dependencyTextResult = dependencyTextRegex.exec(ivyXmlContents);

	if (!dependencyTextResult) {
		return [];
	}

	var dependencyText = dependencyTextResult[1];

	var libraryDependencyRegex = /\sname="([^"]*)" org="([^"]*)" rev="([^"]*)"/;
	var getLibraryDependencies = highland.partial(getDependenciesWithStreams, dependencyText, getPluginLibraryDependency);
	return getLibraryDependencies(libraryDependencyRegex);
};

function getPluginDependencies(folder) {
	var ivyDependencies = getIvyDependencies(folder);
	var coreLibraryDependencies = getPluginPackageLibraryDependencies(folder);

	var deploymentContextDependencies = getPluginPackageProjectDependencies(folder);
	var sharedDependencies = getSharedDependencies(folder);

	return {
		libraryDependencies: ivyDependencies.concat(coreLibraryDependencies),
		projectDependencies: deploymentContextDependencies.concat(sharedDependencies).map(getProjectDependency)
	};
}

function getPluginDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getPluginIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(moduleIncludeFolders);
	var moduleDependencies = getPluginDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

function getPluginFolders(portalSourceFolder, pluginSourceFolder) {
	var pluginFolders = [];

	var pluginSubFolders = ['hooks', 'modules', 'portlets', 'shared', 'webs'];
	var pluginRootPath = path.relative(portalSourceFolder, pluginSourceFolder);

	if (isPluginFolder(pluginRootPath)) {
		pluginFolders = pluginFolders.concat([pluginRootPath]);
	}

	var pluginSubPaths = [];

	if (pluginSubFolders.indexOf(path.basename(pluginRootPath)) != -1) {
		pluginSubPaths = [pluginRootPath];
	}
	else {
		var getPluginPath = highland.partial(getFilePath, pluginRootPath);
		pluginSubPaths = pluginSubFolders.map(getPluginPath);
	}

	for (var j = 0; j < pluginSubPaths.length; j++) {
		var pluginSubPath = pluginSubPaths[j];
		var findResults = getFolders(pluginSubPath, 2);

		pluginFolders = pluginFolders.concat(
			findResults.filter(isPluginFolder)
		);
	}

	return pluginFolders;
};

function getPluginIncludeFolders(folder) {
	var moduleIncludeFolders = getModuleIncludeFolders(folder);

	if (moduleIncludeFolders.sourceFolders.length != 0) {
		return moduleIncludeFolders;
	}

	if (isDirectory(getFilePath(folder, 'src'))) {
		moduleIncludeFolders.sourceFolders.push('src');
	}

	return moduleIncludeFolders;
};

function getPluginLibraryDependency(matchResult) {
	if (matchResult == null) {
		return null;
	}

	var dependency = {
		type: 'library',
		group: matchResult[2],
		name: matchResult[1],
		version: matchResult[3]
	};

	if (dependency.version.indexOf('SNAPSHOT') != -1) {
		return null;
	}

	return dependency;
};

function getPluginPackageLibraryDependencies(folder) {
	var dependencyNames = ['development', 'global'];

	var pluginPackagePath = getFilePath(folder, 'docroot/WEB-INF/liferay-plugin-package.properties');

	if (isFile(pluginPackagePath)) {
		var pluginPackageContents = fs.readFileSync(pluginPackagePath);

		if (pluginPackageContents.toString().indexOf('portal-dependency-jars=') != -1) {
			dependencyNames.push('portal');
		}
	}

	return dependencyNames.map(getLibraryDependency);
}

function getPluginPackageProjectDependencies(folder) {
	var dependencyNames = ['portal-kernel', 'portal-service', 'util-bridges', 'util-java', 'util-taglib']
		.filter(isModuleDependencyAvailable);

	var pluginPackagePath = getFilePath(folder, 'docroot/WEB-INF/liferay-plugin-package.properties');

	if (isFile(pluginPackagePath)) {
		var pluginPackageContents = fs.readFileSync(pluginPackagePath);
		var pluginPackageLines = pluginPackageContents.toString().split('\n');

		var foundRequiredDeploymentContext = false;

		for (var i = 0; i < pluginPackageLines.length; i++) {
			var line = pluginPackageLines[i];

			if (line.indexOf('required-deployment-contexts') != -1) {
				foundRequiredDeploymentContext = true;
			}
			else if (foundRequiredDeploymentContext) {
				var dependencyName = line.replace(/^\s*/g, '');
				var pos = dependencyName.indexOf(',');

				if (pos == -1) {
					foundRequiredDeploymentContext = false;
				}
				else {
					dependencyName = dependencyName.substring(0, pos);
				}

				dependencyNames.push(dependencyName);
			}
		}
	}

	return dependencyNames;
};

function getSharedDependencies(folder) {
	var dependencyNames = ['portal-compat-shared'];

	var buildXmlPath = getFilePath(folder, 'build.xml');
	var buildXmlContents = fs.readFileSync(buildXmlPath);

	var dependencyTextRegex = /<property name="import.shared" value="([^"]*)"/g;
	var dependencyTextResult = dependencyTextRegex.exec(buildXmlContents);

	if (!dependencyTextResult) {
		return dependencyNames;
	}

	return dependencyNames.concat(dependencyTextResult[1].split(','));
};

function isCoreFolder(folder) {
	var getPath = getFilePath.bind(null, folder);

	var subfiles = ['build.xml'];
	var subfolders = ['docroot', 'src'];

	return subfiles.map(getPath).every(isFile) &&
		subfolders.map(getPath).some(isDirectory);
};

function isModuleDependencyAvailable(dependencyName) {
	return isDirectory(dependencyName) || isDirectory(getFilePath('modules/core', dependencyName));
};

function isPluginFolder(folder) {
	if (!isCoreFolder(folder)) {
		return false;
	}

	var pluginName = path.basename(folder);

	return (pluginName.indexOf('test-') != 0) && (pluginName.indexOf('sample-') != 0);
};

exports.getCoreDetails = getCoreDetails;
exports.getCoreFolders = getCoreFolders;
exports.getFilePath = getFilePath;
exports.getPluginDetails = getPluginDetails;
exports.getPluginFolders = getPluginFolders;
exports.isValidSourcePath = isValidSourcePath;