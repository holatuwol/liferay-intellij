var comparators = require('comparators').default;
var fs = require('fs');
var path = require('path');
var highland = require('highland');
var streams2 = require('../streams2/streams2');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');

var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getIntellijXML = streams6.getIntellijXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var saveContent = streams6.saveContent;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	projectFileStream
		.sortBy(comparators.comparing('moduleName'))
		.map(getModuleElement)
		.collect()
		.map(getModulesElement)
		.map(getWorkspaceModulesXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getAncestorFiles(folder, filename) {
	var ancestorFiles = [];

	var basename = '';

	do {
		var filePath = getFilePath(folder, filename);

		if (isFile(filePath) || isDirectory(filePath)) {
			ancestorFiles.push(filePath);
		}

		folder = path.dirname(folder);
		basename = path.basename(folder);
	}
	while ((basename != '') && (basename != '.') && (basename != '..'));

	var filePath = getFilePath(folder, filename);

	if ((basename != '..') && (isFile(filePath) || isDirectory(filePath))) {
		ancestorFiles.push(filePath);
	}

	return ancestorFiles;
};

function getModuleElement(module) {
	var moduleIMLPath = getModuleIMLPath(module);

	if ((moduleIMLPath.charAt(0) != '/') && (moduleIMLPath.indexOf(':') == -1)) {
		moduleIMLPath = '$PROJECT_DIR$/' + moduleIMLPath;
	}

	var moduleElement = '<module ' +
		'fileurl="file://' + moduleIMLPath + '" ' +
		'filepath="' + moduleIMLPath + '" ';

	var groupName = getModuleGroupName(module);

	if (groupName) {
		moduleElement += 'group="' + groupName + '" ';
	}

	moduleElement += '/>';

	return moduleElement;
};

function getLiferayWorkspaceModuleGroup(module, gradlePropertiesPaths) {
	if (gradlePropertiesPaths.length == 0) {
		return null;
	}

	for (var i = 0; i < gradlePropertiesPaths.length && moduleRelativePath == null; i++) {
		var gradlePropertiesContent = fs.readFileSync(gradlePropertiesPaths[i]);

		var projectPrefixRegex = /project.path.prefix=:(.*)/g;
		var matchResult = projectPrefixRegex.exec(gradlePropertiesContent);

		if (matchResult) {
			return matchResult[1].split(':').join('/');
		}
	}

	var modulesRoot = path.dirname(gradlePropertiesPaths[gradlePropertiesPaths.length - 1]);

	if (path.basename(modulesRoot) == 'liferay') {
		modulesRoot = path.dirname(modulesRoot);
	}

	var modulesRootParent = path.dirname(modulesRoot);

	var moduleRelativePath = module.modulePath.substring(modulesRootParent.length + 1);

	var moduleGroup = path.dirname(moduleRelativePath);

	return moduleGroup;
}

function getLiferayPluginsSDKModuleGroup(module, ivySettingsPaths) {
	if (ivySettingsPaths.length == 0) {
		return null;
	}

	var pos = ivySettingsPaths[ivySettingsPaths.length - 1].lastIndexOf('/');

	if (pos == -1) {
		return null;
	}

	var pluginTypeRoot = module.modulePath.substring(0, pos);
	var sdkRoot = path.dirname(pluginTypeRoot);

	var sdkRelativePath = module.modulePath.substring(sdkRoot.length + 1);
	return path.dirname(sdkRelativePath);
}

function getModuleGroupName(module) {
	if (module.modulePath == 'modules') {
		return null;
	}

	if (module.type == 'portal') {
		return 'portal';
	}

	if (module.modulePath.indexOf('modules/') == 0) {
		return path.dirname(module.modulePath);
	}

	var moduleGroup = getLiferayWorkspaceModuleGroup(module, getAncestorFiles(module.modulePath, 'gradle.properties'));

	if (moduleGroup != null) {
		return moduleGroup;
	}

	moduleGroup = getLiferayWorkspaceModuleGroup(module, getAncestorFiles(module.modulePath, 'liferay/gradle.properties'));

	if (moduleGroup != null) {
		return moduleGroup;
	}

	moduleGroup = getLiferayPluginsSDKModuleGroup(module, getAncestorFiles(module.modulePath, 'ivy-settings.xml'));

	if (moduleGroup != null) {
		return moduleGroup;
	}

	console.warn('Unable to auto-detect IntelliJ module group for ' + module.modulePath);

	return '';
};

function getModuleOrderEntryElement(module, dependency) {
	var elementXML = [
		'<orderEntry type="module" module-name="',
		dependency.name,
		'" scope="',
		isTestDependency(module, dependency) ? "TEST" : "PROVIDED",
		'" ',
		dependency.exported ? 'exported="" ' : '',
		'/>'
	];

	return elementXML.join('');
};

function getModulesElement(moduleElements) {
	return '<modules>\n' + moduleElements.join('\n') + '\n</modules>';
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = [streams6.getNewModuleRootManagerXML(module)];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(getProjectOrderEntryElements(module));

	return newModuleRootManagerXML.join('\n');
};

function getProjectOrderEntryElements(module) {
	if (!module.projectDependencies) {
		return [];
	}

	return module.projectDependencies
		.map(highland.partial(getModuleOrderEntryElement, module));
};

function getWorkspaceModulesXML(modulesElement) {
	return {
		fileName: '.idea/modules.xml',
		components: [
			{
				name: 'ProjectModuleManager',
				content: modulesElement
			}
		]
	};
};

function isTestDependency(module, dependency) {
	if (dependency.testScope) {
		return true;
	}

	if ((module.testSourceFolders) && (module.testSourceFolders.length > 0) && (module.modulePath.indexOf('modules/sdk/') == -1)) {
		return (module.sourceFolders.length == 0) || (dependency.name.indexOf('-test') != -1);
	}

	return false;
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getAncestorFiles = getAncestorFiles;
exports.getModuleElement = getModuleElement;
exports.getModulesElement = getModulesElement;
exports.getModuleXML = getModuleXML;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;
exports.getProjectOrderEntryElements = getProjectOrderEntryElements;
exports.getWorkspaceModulesXML = getWorkspaceModulesXML;
exports.isTestDependency = isTestDependency;