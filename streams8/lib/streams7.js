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
		.sortBy(comparators.comparing('modulePath'))
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

	if (moduleGroupName.indexOf('modules/') == 0) {
		return moduleGroupName;
	}

	var pos = moduleGroupName.indexOf('/');

	while (pos != -1) {
		var rootName = moduleGroupName.substring(0, pos);

		if (rootName.indexOf('plugins') != -1) {
			return moduleGroupName;
		}

		moduleGroupName = moduleGroupName.substring(pos + 1);
		pos = moduleGroupName.indexOf('/');
	}

	return 'portal';
};

function getModuleOrderEntryElement(projectDependency) {
	return '<orderEntry type="module" module-name="' + projectDependency.name + '" />';
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
	var newModuleRootManagerXML = ['<content url="file://$MODULE_DIR$">'];

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
			.map(getModuleOrderEntryElement);

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