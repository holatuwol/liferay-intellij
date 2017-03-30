var comparators = require('comparators').default;
var fs = require('fs');
var path = require('path');
var highland = require('highland');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');

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

	while ((basename != '.') && (basename != '..')) {
		var filePath = getFilePath(folder, filename);

		if (isFile(filePath) || isDirectory(filePath)) {
			ancestorFiles.push(filePath);
		}

		folder = path.dirname(folder);
		basename = path.basename(folder);
	}

	if ((basename != '..') && (isFile(filename) || isDirectory(filename))) {
		ancestorFiles.push(filename);
	}

	return ancestorFiles;
};

function getModuleElement(module) {
	var moduleIMLPath = getModuleIMLPath(module);

	return '<module ' +
		'fileurl="file://$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'filepath="$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'group="' + getModuleGroupName(module) + '" />'
};

function getModuleGroupName(module) {
	if (module.type == 'portal') {
		return 'portal';
	}

	if (module.type == 'plugins-sdk') {
		var pluginSDKRoot = path.normalize(getFilePath(module.modulePath, '../../..'));

		return module.modulePath.substring(pluginSDKRoot.length + 1);
	}

	var groupPrefix = '';
	var modulesRoot = '';

	var gradlePropertiesPaths = getAncestorFiles(module.modulePath, 'gradle.properties');

	for (var i = 0; i < gradlePropertiesPaths.length; i++) {
		var gradlePropertiesContent = fs.readFileSync(gradlePropertiesPaths[i]);

		var projectPrefixRegex = /project.path.prefix=:(.*)/g;
		var matchResult = projectPrefixRegex.exec(gradlePropertiesContent);

		if (matchResult) {
			groupPrefix = 'modules/' + matchResult[1].split(':').join('/');
			modulesRoot = path.dirname(gradlePropertiesPaths[0]);

			break;
		}
	}

	if (groupPrefix == '') {
		var gradlePaths = getAncestorFiles(module.modulePath, 'gradlew');

		if (gradlePaths.length > 0) {
			var pos = gradlePaths[gradlePaths.length - 1].lastIndexOf('/');

			if (pos != -1) {
				modulesRoot = module.modulePath.substring(0, pos);
			}
			else {
				modulesRoot = '';
			}
		}
		else {
			console.error('Unable to find gradlew for', module.modulePath);
		}
	}

	var relativeGroupName = path.dirname(module.modulePath);

	if ((modulesRoot != '') && (modulesRoot != '.')) {
		if (modulesRoot.indexOf('../') != -1) {
			relativeGroupName = path.dirname(module.modulePath.substring(path.dirname(modulesRoot).length + 1));
		}
		else {
			relativeGroupName = path.dirname(module.modulePath.substring(modulesRoot.length + 1));
		}
	}

	if (groupPrefix == '') {
		return relativeGroupName;
	}
	else if (relativeGroupName == '.') {
		return groupPrefix;
	}
	else {
		return groupPrefix + '/' + relativeGroupName;
	}
};

function getModuleOrderEntryElement(module, dependency) {
	var extraAttributes = '';

	if (isTestDependency(module, dependency)) {
		extraAttributes = 'scope="TEST" ';
	}
	else if (dependency.exported) {
		extraAttributes = 'exported="" ';
	}

	return '<orderEntry type="module" module-name="' + dependency.name + '" ' + extraAttributes + '/>';
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

	if (module.projectDependencies) {
		var projectOrderEntryElements = module.projectDependencies
			.map(highland.partial(getModuleOrderEntryElement, module));

		newModuleRootManagerXML = newModuleRootManagerXML.concat(projectOrderEntryElements);
	}

	return newModuleRootManagerXML.join('\n');
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
exports.getWorkspaceModulesXML = getWorkspaceModulesXML;
exports.isTestDependency = isTestDependency;