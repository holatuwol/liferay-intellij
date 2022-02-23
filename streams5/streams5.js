var fs = require('fs');
var highland = require('highland');
var path = require('path');
var streams2 = require('../streams2/streams2');
var streams3 = require('../streams4/streams3');
var streams4 = require('./streams4');
var util = require('util');

var sourceFolders = ['src'];
var resourceFolders = [];
var testSourceFolders = ['test/unit', 'test/integration'];
var testResourceFolders = ['test/functional'];
var webrootFolders = ['docroot'];

var getFilePath = function(item1, item2) {
	return streams2.getFilePath(item1, item2);
};

var flipGetFilePath = function(item1, item2) {
	return getFilePath(item2, item1);
};

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
	projectNames: ['portal-kernel', 'portal-service', 'registry-api']
};

var customDependencyNames = {
	'portal-impl': {
		projectNames: ['portal-kernel', 'portal-service', 'portal-test', 'portal-test-integration', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	},
	'portal-kernel': {
		projectNames: ['registry-api', 'portal-test']
	},
	'portal-service': {
		projectNames: ['registry-api']
	},
	'portal-web-docroot': {
		projectNames: ['portal-impl', 'portal-kernel', 'portal-service', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	},
	'portal-test-integration': {
		projectNames: ['portal-impl', 'portal-kernel', 'portal-service', 'portal-test', 'registry-api', 'util-java']
	},
	'util-java': {
		projectNames: ['portal-kernel', 'portal-service', 'portal-test', 'registry-api']
	},
	'util-taglib': {
		projectNames: ['portal-kernel', 'portal-service', 'registry-api', 'util-java']
	}
};

function flatMap(array, lambda) {
	return Array.prototype.concat.apply([], array.map(lambda));
};

function getCoreDependency(dependencyType, dependencyName) {
	return {
		type: dependencyType,
		name: dependencyName,
		exported: ('project' == dependencyType)
	};
};

function getCoreDependencies(portalPreModules, folder) {
	var dependencyNames = defaultDependencyNames;

	if (folder in customDependencyNames) {
		dependencyNames = customDependencyNames[folder];
	}

	var coreProjectDependencies = dependencyNames.projectNames.filter(isDirectory);

	if (folder == 'portal-kernel') {
		coreProjectDependencies = coreProjectDependencies.concat(portalPreModules);
	}

	return {
		libraryDependencies: ['development', 'global', 'portal'].map(getLibraryDependency),
		projectDependencies: coreProjectDependencies.map(getProjectDependency)
	};
};

function getCoreDetails(portalPreModules, folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getCoreIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getCoreDependencies(portalPreModules, folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {type: 'portal'});
};

function getCoreFolders() {
	var findResultFolders = getFolders('.', 0);
	var coreFolders = findResultFolders.filter(isCoreFolder);

	var coreResourceFolders = ['definitions', 'lib', 'sql'];
	coreResourceFolders = coreResourceFolders.filter(isDirectory);

	return coreFolders.concat(coreResourceFolders);
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

	if ((moduleIncludeFolders.sourceFolders.length == 0) &&
		(moduleIncludeFolders.resourceFolders.length == 0) &&
		(moduleIncludeFolders.testSourceFolders.length == 0) &&
		(moduleIncludeFolders.testResourceFolders.length == 0) &&
		(moduleIncludeFolders.webrootFolders.length == 0)) {

		moduleIncludeFolders.resourceFolders.push('.');
	}

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
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getPluginDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {type: 'plugins-sdk'});
};

function getPluginFolder(pluginSDKRoot, pluginName) {
	var parentRelativeFolders = ['hooks', 'modules', 'portlets', 'shared', 'themes', 'webs'];
	var parentAbsoluteFolders = parentRelativeFolders.map(getFilePath(pluginSDKRoot));

	var getPluginPath = flipGetFilePath(pluginName);
	var pluginCandidateFolders = parentAbsoluteFolders.map(getPluginPath);

	var pluginFolders = pluginCandidateFolders.filter(isDirectory);

	if (pluginFolders.length == 0) {
		return null;
	}

	return pluginFolders[0];
};

function getPluginFolders(portalSourceFolder, pluginSourceFolder) {
	var pluginFolders = null;

	if (isPluginFolder(pluginSourceFolder)) {
		pluginFolders = getPluginProjectFolders(pluginSourceFolder);
	}
	else {
		var findResults = getFolders(pluginSourceFolder, 2);
		pluginFolders = findResults.filter(isPluginFolder);
	}

	pluginFolders.sort();

	var uniquePluginFolders = pluginFolders.filter(isUniqueAssumeSorted);

	var portalSourceRelativePath = highland.partial(path.relative, portalSourceFolder);

	return uniquePluginFolders.map(portalSourceRelativePath);
};

function getPluginIncludeFolders(folder) {
	var moduleIncludeFolders = getModuleIncludeFolders(folder);

	if (moduleIncludeFolders.sourceFolders.length == 0) {
		if (isDirectory(getFilePath(folder, 'src'))) {
			moduleIncludeFolders.sourceFolders.push('src');
		}

		if (isDirectory(getFilePath(folder, 'service'))) {
			moduleIncludeFolders.sourceFolders.push('service');
		}
	}

	var portletXmlPath = getFilePath(folder, 'docroot/WEB-INF/portlet.xml');

	if (isFile(portletXmlPath)) {
		moduleIncludeFolders.webrootFolders.push('docroot');

		var portletXmlContent = fs.readFileSync(portletXmlPath);

		if (portletXmlContent.indexOf('com.liferay.alloy.mvc.AlloyPortlet')) {
			moduleIncludeFolders.sourceFolders.push('docroot/WEB-INF/jsp');
		}
	}

	var hookJspPath = getFilePath(folder, 'docroot/META-INF/custom_jsps');

	if (isDirectory(hookJspPath)) {
		moduleIncludeFolders.webrootFolders.push('docroot/META-INF/custom_jsps');
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
		.filter(isDirectory);

	var hookJspPath = getFilePath(folder, 'docroot/META-INF/custom_jsps');

	if (isDirectory(hookJspPath)) {
		dependencyNames.push('portal-web-docroot');
	}

	return dependencyNames.concat(getPluginPackageRequiredDeploymentContexts(folder));
};

function getPluginPackageRequiredDeploymentContexts(folder) {
	var pluginPackagePath = getFilePath(folder, 'docroot/WEB-INF/liferay-plugin-package.properties');

	var deploymentContexts = [];

	if (!isFile(pluginPackagePath)) {
		return deploymentContexts;
	}

	var pluginPackageContents = fs.readFileSync(pluginPackagePath);
	var pluginPackageLines = pluginPackageContents.toString().split('\n');

	var foundRequiredDeploymentContext = false;

	for (var i = 0; i < pluginPackageLines.length; i++) {
		var line = pluginPackageLines[i].trim();

		var contextLine = null;

		if (line.indexOf('required-deployment-contexts=') == 0) {
			contextLine = line.substring(line.indexOf('=') + 1);
		}
		else if (foundRequiredDeploymentContext) {
			contextLine = line;
		}
		else {
			continue;
		}

		var pos = contextLine.indexOf('\\');
		foundRequiredDeploymentContext = pos != -1;

		if (foundRequiredDeploymentContext) {
			contextLine = contextLine.substring(0, pos);
		}

		var contexts = contextLine.trim().split(',');

		for (var j = 0; j < contexts.length; j++) {
			var context = contexts[j].trim();

			if (context) {
				deploymentContexts.push(context);
			}
		}
	}

	return deploymentContexts;
};

function getPluginProjectFolders(folder) {
	var pluginSDKRoot = getPluginSDKRoot(folder);
	var getPluginRootFolder = highland.partial(getPluginFolder, pluginSDKRoot);

	var sharedDependencies = getSharedDependencies(folder);
	var sharedDependenciesFolders = sharedDependencies.map(getPluginRootFolder);
	var pluginFolders = [folder].concat(sharedDependenciesFolders);

	var newPluginNames = getPluginPackageRequiredDeploymentContexts(folder);
	var newPluginFolders = newPluginNames.map(getPluginRootFolder);

	if (newPluginFolders.length > 0) {
		pluginFolders = pluginFolders.concat(flatMap(newPluginFolders, getPluginProjectFolders));
	}

	return pluginFolders;
};

function getPluginSDKRoot(folder) {
	var relativeFolders = ['.', '..', '../..'];
	var absoluteFolders = relativeFolders.map(getFilePath(folder));

	var getBuildCommonPluginsPath = flipGetFilePath('build-common-plugins.xml');
	var hasBuildCommonPlugins = highland.compose(isFile, getBuildCommonPluginsPath);

	var pluginSDKRoots = absoluteFolders.filter(hasBuildCommonPlugins);

	if (pluginSDKRoots.length == 0) {
		return null;
	}

	return pluginSDKRoots[0];
};

function getSharedDependencies(folder) {
	var dependencyNames = ['portal-compat-shared'];

	var buildXmlPath = getFilePath(folder, 'build.xml');

	if (!isFile(buildXmlPath)) {
		return dependencyNames;
	}

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

	var subfolders = ['docroot', 'src'];

	return subfolders.map(getPath).some(isDirectory);
};

function isPluginFolder(folder) {
	var getPath = getFilePath.bind(null, folder);

	var files = ['docroot/WEB-INF/liferay-plugin-package.properties', 'src/WEB-INF/liferay-plugin-package.properties'];

	return files.map(getPath).some(isFile);
};

function isUniqueAssumeSorted(element, index, array) {
	return index == 0 || array[index - 1] != element;
};

exports.getCoreDetails = getCoreDetails;
exports.getCoreFolders = getCoreFolders;
exports.getFilePath = getFilePath;
exports.getPluginDetails = getPluginDetails;
exports.getPluginFolders = getPluginFolders;
exports.getPluginSDKRoot = getPluginSDKRoot;
exports.isValidSourcePath = isValidSourcePath;