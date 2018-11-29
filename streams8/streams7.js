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

	return '<module ' +
		'fileurl="file://$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'filepath="$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'group="' + getModuleGroupName(module) + '" />'
};

function getModuleGroupName(module) {
	if (module.type == 'portal') {
		return 'portal';
	}

	var pos = module.modulePath.indexOf('modules/') == 0 ? 0 : module.modulePath.indexOf('/modules/');

	if (pos != -1) {
		var modulesRoot = module.modulePath.substring(0, pos);

		if (modulesRoot == '') {
			return path.dirname(module.modulePath);
		}

		var modulesRootParent = path.dirname(modulesRoot);
		var moduleRelativePath = module.modulePath.substring(modulesRootParent.length + 1);
		return path.dirname(moduleRelativePath);
	}

	var gradlePropertiesPaths = getAncestorFiles(module.modulePath, 'gradle.properties');

	for (var i = 0; i < gradlePropertiesPaths.length; i++) {
		var gradlePropertiesContent = fs.readFileSync(gradlePropertiesPaths[i]);

		var projectPrefixRegex = /project.path.prefix=:(.*)/g;
		var matchResult = projectPrefixRegex.exec(gradlePropertiesContent);

		if (matchResult) {
			return 'subrepo/' + matchResult[1].split(':').join('/');
		}
	}

	var gradlePaths = getAncestorFiles(module.modulePath, 'gradlew');

	if (gradlePaths.length > 0) {
		var pos = gradlePaths[gradlePaths.length - 1].lastIndexOf('/');

		if (pos != -1) {
			var modulesRoot = module.modulePath.substring(0, pos);

			var modulesRootParent = path.dirname(modulesRoot);
			var moduleRelativePath = module.modulePath.substring(modulesRootParent.length + 1);
			return path.dirname(moduleRelativePath);
		}
	}

	console.warn('Unable to detect group for ' + module.modulePath);

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