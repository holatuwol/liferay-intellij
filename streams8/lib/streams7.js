var comparators = require('comparators').default;
var highland = require('highland');
var streams6 = require('./streams6');

var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getIntellijXML = streams6.getIntellijXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
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

function getModuleElement(module) {
	var moduleIMLPath = getModuleIMLPath(module);

	return '<module ' +
		'fileurl="file://$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'filepath="$PROJECT_DIR$/' + moduleIMLPath + '" ' +
		'group="' + getModuleGroupName(module) + '" />'
};

function getModuleGroupName(module) {
	var pos = module.modulePath.lastIndexOf('/');

	var moduleGroupName = module.modulePath.substring(0, pos);

	var pos = moduleGroupName.indexOf('modules/');

	if (pos == 0) {
		return moduleGroupName;
	}

	pos = moduleGroupName.indexOf('/modules/');

	if (pos != -1) {
		return moduleGroupName.substring(pos + 1);
	}

	pos = moduleGroupName.indexOf('/plugins/');

	if (pos != -1) {
		return moduleGroupName.substring(pos + 1);
	}

	pos = moduleGroupName.lastIndexOf('../');

	if (pos != -1) {
		moduleGroupName = moduleGroupName.substring(pos + 3);

		if (moduleGroupName == '..') {
			moduleGroupName = module.modulePath.substring(module.modulePath.lastIndexOf('/') + 1);
		}

		return moduleGroupName;
	}

	return 'portal';
};

function getModuleOrderEntryElement(module, projectDependency) {
	var isTestDependency = (projectDependency.name.indexOf('-test') != -1) &&
		((module.moduleName.indexOf('-test') == -1) || (module.modulePath.indexOf('modules/') == 0));

	if (isTestDependency) {
		return '<orderEntry type="module" module-name="' + projectDependency.name + '" scope="TEST" />';
	}
	else {
		return '<orderEntry type="module" module-name="' + projectDependency.name + '" />';
	}
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
	var newModuleRootManagerXML = [
		'<output url="file://$MODULE_DIR$/classes" />',
		'<output-test url="file://$MODULE_DIR$/test-classes" />',
		'<content url="file://$MODULE_DIR$">'
	];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(
		module.sourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'false')),
		module.resourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-resource')),
		module.testSourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'true')),
		module.testResourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-test-resource')),
		module.excludeFolders.map(getExcludeFolderElement)
	);

	newModuleRootManagerXML.push('</content>');
	newModuleRootManagerXML.push('<orderEntry type="inheritedJdk" />');
	newModuleRootManagerXML.push('<orderEntry type="sourceFolder" forTests="false" />');

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

exports.createProjectWorkspace = createProjectWorkspace;
exports.getModuleElement = getModuleElement;
exports.getModuleOrderEntryElement = getModuleOrderEntryElement;
exports.getModulesElement = getModulesElement;
exports.getModuleXML = getModuleXML;
exports.getWorkspaceModulesXML = getWorkspaceModulesXML;