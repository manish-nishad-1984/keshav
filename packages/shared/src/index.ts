export type { NavGroupKey, ModuleDefinition } from './modules';
export type { StatusTone, StatusDescriptor } from './status';
export type { ParsedIdentifier } from './identity';

import * as modulesImpl from './modules';
import * as statusImpl from './status';
import * as identityImpl from './identity';

export const NAV_GROUPS = modulesImpl.NAV_GROUPS;
export const MODULES = modulesImpl.MODULES;
export const getModule = modulesImpl.getModule;
export const getModulesByGroup = modulesImpl.getModulesByGroup;
export const getModuleByPath = modulesImpl.getModuleByPath;

export const describeStatus = statusImpl.describeStatus;

export const parseLoginIdentifier = identityImpl.parseLoginIdentifier;
