'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getServices, getEmployeeServices, deleteService, deleteEmployeeService, getServiceCatalogConfig, saveServiceCatalogConfig, updateService } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import type { Service, ServiceCatalogConfig, ServiceCatalogMainGroup } from '@/shared/lib/types';
import { useLanguage } from '@/shared/context/LanguageContext';
import {
  createCatalogGroupDraft,
  createCatalogSubgroupDraft,
  DEFAULT_SALON_ID,
  getCatalogGroupLabel,
  getCatalogSubgroupLabel,
  compareServicesByDisplayOrder,
  getDefaultServiceCatalogConfig,
  getMissingCatalogSubgroupLabel,
  getServiceGroupId,
  getServiceSubgroupId,
} from '@/shared/lib/serviceCatalog';

type ServiceSubgroup = {
  key: string;
  label: string;
  services: Service[];
};

export default function ServicesPage() {
  const { language } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [catalogConfig, setCatalogConfig] = useState<ServiceCatalogConfig>(getDefaultServiceCatalogConfig());
  const [loading, setLoading] = useState(true);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [catalogDirty, setCatalogDirty] = useState(false);
  const [activeCatalogGroupId, setActiveCatalogGroupId] = useState<string>('beauty-face');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>({});
  const activeCatalogGroup = useMemo(
    () => catalogConfig.groups.find((group) => group.id === activeCatalogGroupId) || catalogConfig.groups[0] || null,
    [catalogConfig.groups, activeCatalogGroupId]
  );

  const copy =
    language === 'es'
      ? {
          title: 'Servicios',
          subtitle: 'Anade o edita servicios rapido.',
          refreshList: 'Actualizar lista',
          importing: 'Importando...',
          importList: 'Importar lista',
          linkCopied: 'Enlace copiado',
          shareBookings: 'Compartir reservas',
          bookingLinkTitle: 'Enlace de reservas',
          bookingLinkSubtitle: 'Copia el enlace general cuando lo necesites.',
          copied: 'Copiado',
          copyLink: 'Copiar enlace',
          listTitle: 'Servicios',
          tools: 'Herramientas',
          searchPlaceholder: 'Buscar por nombre, descripcion o grupo',
          status: 'Estado',
          allServices: 'Todos los servicios',
          onlyActive: 'Solo activos',
          onlyHidden: 'Solo ocultos',
          total: 'total',
          active: 'activos',
          hidden: 'ocultos',
          groupedByCategory: 'Listado por grupos',
          groups: 'grupos',
          servicesWord: 'servicios',
          expanded: 'expandidos',
          expandAll: 'Expandir todo',
          collapseAll: 'Colapsar todo',
          service: 'Servicio',
          assignedTo: 'Asignado a',
          time: 'Tiempo',
          price: 'Precio',
          actions: 'Acciones',
          emptyCatalog: 'Catalogo vacio',
          noServicesMatch: 'Ningun servicio coincide con los filtros',
          noServicesMatchHint: 'Prueba limpiando la busqueda o el filtro de estado.',
          subgroups: 'subgrupos',
          therapists: 'especialistas',
          collapsed: 'Colapsado',
          expandedState: 'Expandido',
          noServicesInGroup: 'No hay servicios en este grupo.',
          subgroup: 'Subgrupo',
          needsTherapist: 'Necesita especialista',
          link: 'Enlace',
          saving: 'Guardando',
          save: 'Guardar',
          cancel: 'Cancelar',
          edit: 'Editar',
          addService: 'Anadir Servicio',
          addGroup: 'Anadir grupo',
          deleteGroup: 'Eliminar grupo',
          deleteAllServices: 'Eliminar todos los servicios',
          deleting: 'Eliminando...',
          deleteAllServicesConfirm: '¿Eliminar todos los servicios? Los grupos y subgrupos se mantendran.',
          deleteGroupConfirm: '¿Eliminar este grupo?',
          deleteGroupUsedConfirm: (count: number, name: string) =>
            `Este grupo se usa en ${count} servicio(s): ${name}. Si lo eliminas, esos servicios seguiran existiendo pero quedaran fuera del catalogo. ¿Quieres continuar?`,
          typeToDeleteGroup: (name: string) => `Para eliminar este grupo, escribe exactamente: ${name}`,
          typeToDeleteSubgroup: (name: string) => `Para eliminar este subgrupo, escribe exactamente: ${name}`,
          deleteNameMismatch: 'El texto no coincide. Eliminacion cancelada.',
          allServicesDeleted: 'Todos los servicios han sido eliminados.',
          deleteAllFailed: 'No se pudieron eliminar todos los servicios.',
          catalogTitle: 'Organizar grupos',
          catalogSubtitle: 'Primero crea la estructura. Despues anade servicios dentro de cada subgrupo.',
          manageCatalog: 'Organizar grupos',
          hideCatalog: 'Ocultar',
          showCatalog: 'Abrir',
          catalogPanelClosed: 'Plegado',
          catalogPanelOpen: 'Abierto',
          unsavedChanges: 'Cambios sin guardar',
          chooseMainGroup: 'Selecciona un grupo principal',
          editGroupNames: 'Nombre del grupo',
          changeGroupTitle: 'Edita el titulo visible en ambos idiomas.',
          editSubgroups: 'Subgrupos',
          subgroupRowHint: 'Crea o ajusta subgrupos aqui.',
          englishName: 'Nombre en ingles',
          spanishName: 'Nombre en espanol',
          englishPlaceholder: 'Nombre en ingles',
          spanishPlaceholder: 'Nombre en espanol',
          addSubgroup: 'Anadir subgrupo',
          deleteLabel: 'Eliminar',
          noSubgroupsYet: 'Aun no hay subgrupos. Anade el primero para este grupo.',
          finalStepSave: 'Guarda los cambios cuando termines este grupo.',
          catalogSaved: 'Catalogo guardado.',
          deleteSubgroupConfirm: '¿Eliminar este subgrupo?',
          deleteSubgroupUsedConfirm: (count: number, name: string) =>
            `Este subgrupo se usa en ${count} servicio(s): ${name}. Si lo eliminas, esos servicios seguiran existiendo pero apareceran como subgrupo sin catalogar. ¿Quieres continuar?`,
          orphanedSubgroups: 'sin catalogar',
          missingSubgroupNotice: 'Hay servicios con subgrupos sin catalogar.',
          saveCatalogFailed: 'No se pudo guardar el catalogo.',
          noGroupsYet: 'Todavia no hay grupos. Crea el primero para empezar.',
          subgroupCount: 'subgrupos',
          serviceCount: 'servicios',
          addServiceHere: 'Anadir servicio aqui',
          emptySubgroup: 'Sin servicios',
          savingOrder: 'Guardando orden...',
          dragToReorder: 'Arrastra para ordenar',
          openSubgroup: 'Abrir',
          closeSubgroup: 'Cerrar',
        }
      : {
          title: 'Services',
          subtitle: 'Add or edit services quickly.',
          refreshList: 'Refresh list',
          importing: 'Importing...',
          importList: 'Import List',
          linkCopied: 'Link Copied!',
          shareBookings: 'Share Bookings',
          bookingLinkTitle: 'Booking link',
          bookingLinkSubtitle: 'Copy the general link when you need it.',
          copied: 'Copied!',
          copyLink: 'Copy Link',
          listTitle: 'Services',
          tools: 'Tools',
          searchPlaceholder: 'Search by name, description, or group',
          status: 'Status',
          allServices: 'All services',
          onlyActive: 'Only active',
          onlyHidden: 'Only hidden',
          total: 'total',
          active: 'active',
          hidden: 'hidden',
          groupedByCategory: 'Services by group',
          groups: 'groups',
          servicesWord: 'services',
          expanded: 'expanded',
          expandAll: 'Expand all',
          collapseAll: 'Collapse all',
          service: 'Service',
          assignedTo: 'Assigned to',
          time: 'Time',
          price: 'Price',
          actions: 'Actions',
          emptyCatalog: 'Empty Catalog',
          noServicesMatch: 'No services match your filters',
          noServicesMatchHint: 'Try clearing the search or status filter.',
          subgroups: 'subgroups',
          therapists: 'therapists',
          collapsed: 'Collapsed',
          expandedState: 'Expanded',
          noServicesInGroup: 'No services in this group.',
          subgroup: 'Subgroup',
          needsTherapist: 'Needs therapist',
          link: 'Link',
          saving: 'Saving',
          save: 'Save',
          cancel: 'Cancel',
          edit: 'Edit',
          addService: 'Add Service',
          addGroup: 'Add group',
          deleteGroup: 'Delete group',
          deleteAllServices: 'Delete all services',
          deleting: 'Deleting...',
          deleteAllServicesConfirm: 'Delete all services? Groups and subgroups will remain.',
          deleteGroupConfirm: 'Delete this group?',
          deleteGroupUsedConfirm: (count: number, name: string) =>
            `This group is used by ${count} service(s): ${name}. If you delete it, those services will still exist but stay outside the catalog. Continue?`,
          typeToDeleteGroup: (name: string) => `To delete this group, type exactly: ${name}`,
          typeToDeleteSubgroup: (name: string) => `To delete this subgroup, type exactly: ${name}`,
          deleteNameMismatch: 'The text did not match. Deletion was cancelled.',
          allServicesDeleted: 'All services were deleted.',
          deleteAllFailed: 'Could not delete all services.',
          catalogTitle: 'Organize groups',
          catalogSubtitle: 'Create the structure first, then add services inside each subgroup.',
          manageCatalog: 'Organize groups',
          hideCatalog: 'Hide',
          showCatalog: 'Open',
          catalogPanelClosed: 'Collapsed',
          catalogPanelOpen: 'Open',
          unsavedChanges: 'Unsaved changes',
          chooseMainGroup: 'Choose a main group',
          editGroupNames: 'Group name',
          changeGroupTitle: 'Edit the visible title in both languages.',
          editSubgroups: 'Subgroups',
          subgroupRowHint: 'Create or adjust subgroups here.',
          englishName: 'English name',
          spanishName: 'Spanish name',
          englishPlaceholder: 'English',
          spanishPlaceholder: 'Spanish',
          addSubgroup: 'Add subgroup',
          deleteLabel: 'Delete',
          noSubgroupsYet: 'No subgroups yet. Add the first one for this group.',
          finalStepSave: 'Save your changes when you finish this group.',
          catalogSaved: 'Catalog saved.',
          deleteSubgroupConfirm: 'Delete this subgroup?',
          deleteSubgroupUsedConfirm: (count: number, name: string) =>
            `This subgroup is used by ${count} service(s): ${name}. If you delete it, those services will still exist but show up as unlisted subgroups. Continue?`,
          orphanedSubgroups: 'unlisted',
          missingSubgroupNotice: 'Some services use unlisted subgroups.',
          saveCatalogFailed: 'Could not save catalog.',
          noGroupsYet: 'There are no groups yet. Create the first one to start.',
          subgroupCount: 'subgroups',
          serviceCount: 'services',
          addServiceHere: 'Add service here',
          emptySubgroup: 'No services yet',
          savingOrder: 'Saving order...',
          dragToReorder: 'Drag to reorder',
          openSubgroup: 'Open',
          closeSubgroup: 'Close',
        };

  const getSubgroupPanelKey = (groupId: string, subgroupId: string) => `${groupId}:${subgroupId}`;

  const confirmTypedDeletion = (expectedName: string, message: string): boolean => {
    const typedValue = window.prompt(message, '');
    if (typedValue === null) return false;
    if (typedValue.trim() !== expectedName.trim()) {
      window.alert(copy.deleteNameMismatch);
      return false;
    }
    return true;
  };

  const groupSections = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return catalogConfig.groups.map((group) => {
      const groupServices = services
        .filter((service) => getServiceGroupId(service) === group.id)
        .sort(compareServicesByDisplayOrder);
      const subgroups: ServiceSubgroup[] = group.subgroups.map((subgroup) => {
        const subgroupServices = groupServices.filter((service) => {
          if (getServiceSubgroupId(service) !== subgroup.id) return false;
          if (statusFilter === 'active' && !service.isActive) return false;
          if (statusFilter === 'hidden' && service.isActive) return false;
          if (!term) return true;
          return service.serviceName.toLowerCase().includes(term);
        });
        return {
          key: subgroup.id,
          label: getCatalogSubgroupLabel(subgroup, language === 'es' ? 'es' : 'en'),
          services: subgroupServices,
        };
      });
      const visibleServiceCount = subgroups.reduce((count, subgroup) => count + subgroup.services.length, 0);

      return {
        key: group.id,
        label: getCatalogGroupLabel(group, language === 'es' ? 'es' : 'en'),
        services: groupServices,
        visibleServiceCount,
        subgroups,
      };
    });
  }, [catalogConfig.groups, services, language, searchTerm, statusFilter]);
  const totalSubgroupCount = useMemo(
    () => catalogConfig.groups.reduce((count, group) => count + group.subgroups.length, 0),
    [catalogConfig.groups]
  );
  const orphanedServicesCount = useMemo(
    () =>
      services.filter((service) => {
        const subgroupId = getServiceSubgroupId(service);
        const groupId = getServiceGroupId(service);
        return subgroupId && !catalogConfig.groups.some((group) => group.id === groupId && group.subgroups.some((subgroup) => subgroup.id === subgroupId));
      }).length,
    [services, catalogConfig.groups]
  );

  const fetchServices = async () => {
    setLoading(true);
    try {
      const [servicesData, config] = await Promise.all([
        getServices(),
        getServiceCatalogConfig(DEFAULT_SALON_ID),
      ]);
      setServices(servicesData);
      setCatalogConfig(config);
      setCatalogDirty(false);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const fallbackCopyText = (text: string) => {
    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      console.error('Error copying link:', error);
    }

    document.body.removeChild(textarea);
    return copied;
  };

  const copyToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Error copying link:', error);
      }
    }

    return fallbackCopyText(text);
  };

  const updateCatalogGroupField = (groupId: string, field: 'labelEn' | 'labelEs', value: string) => {
    setCatalogDirty(true);
    setCatalogConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((group) => (group.id === groupId ? { ...group, [field]: value } : group)),
    }));
  };

  const addCatalogGroup = () => {
    const newGroup = createCatalogGroupDraft(catalogConfig);
    setCatalogDirty(true);
    setCatalogConfig((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));
    setActiveCatalogGroupId(newGroup.id);
  };

  const updateCatalogSubgroupField = (
    groupId: string,
    subgroupId: string,
    field: 'labelEn' | 'labelEs',
    value: string
  ) => {
    setCatalogDirty(true);
    setCatalogConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              subgroups: group.subgroups.map((subgroup) =>
                subgroup.id === subgroupId ? { ...subgroup, [field]: value } : subgroup
              ),
            }
          : group
      ),
    }));
  };

  const addCatalogSubgroup = (groupId: string) => {
    setCatalogDirty(true);
    setCatalogConfig((prev) => {
      const targetGroup = prev.groups.find((group) => group.id === groupId);
      if (!targetGroup) return prev;
      const nextSubgroup = createCatalogSubgroupDraft(targetGroup);
      setOpenSubgroups((current) => ({
        ...current,
        [getSubgroupPanelKey(groupId, nextSubgroup.id)]: true,
      }));
      return {
        ...prev,
        groups: prev.groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                subgroups: [...group.subgroups, nextSubgroup],
              }
            : group
        ),
      };
    });
  };

  const deleteCatalogSubgroup = (groupId: string, subgroupId: string) => {
    const affectedServices = services.filter(
      (service) => getServiceGroupId(service) === groupId && getServiceSubgroupId(service) === subgroupId
    );
    const subgroupDraft = catalogConfig.groups
      .find((group) => group.id === groupId)
      ?.subgroups.find((subgroup) => subgroup.id === subgroupId);
    const subgroupName = subgroupDraft
      ? getCatalogSubgroupLabel(subgroupDraft, language === 'es' ? 'es' : 'en')
      : affectedServices[0]
        ? getMissingCatalogSubgroupLabel(subgroupId, language === 'es' ? 'es' : 'en')
        : subgroupId;
    const confirmed = window.confirm(
      affectedServices.length > 0
        ? copy.deleteSubgroupUsedConfirm(affectedServices.length, subgroupName)
        : copy.deleteSubgroupConfirm
    );
    if (!confirmed) return;
    if (!confirmTypedDeletion(subgroupName, copy.typeToDeleteSubgroup(subgroupName))) return;

    setCatalogDirty(true);
    setOpenSubgroups((prev) => {
      const next = { ...prev };
      delete next[getSubgroupPanelKey(groupId, subgroupId)];
      return next;
    });
    setCatalogConfig((prev) => ({
      ...prev,
      groups: prev.groups.map((group) =>
        group.id === groupId
          ? { ...group, subgroups: group.subgroups.filter((subgroup) => subgroup.id !== subgroupId) }
          : group
      ),
    }));
  };

  const deleteCatalogGroup = (groupId: string) => {
    const affectedServices = services.filter((service) => getServiceGroupId(service) === groupId);
    const groupName =
      catalogConfig.groups.find((group) => group.id === groupId)
        ? getCatalogGroupLabel(catalogConfig.groups.find((group) => group.id === groupId)!, language === 'es' ? 'es' : 'en')
        : groupId;
    const confirmed = window.confirm(
      affectedServices.length > 0
        ? copy.deleteGroupUsedConfirm(affectedServices.length, groupName)
        : copy.deleteGroupConfirm
    );
    if (!confirmed) return;
    if (!confirmTypedDeletion(groupName, copy.typeToDeleteGroup(groupName))) return;

    setCatalogDirty(true);
    setCatalogConfig((prev) => ({
      ...prev,
      groups: prev.groups.filter((group) => group.id !== groupId),
    }));
  };

  const persistSubgroupServiceOrder = async (
    groupId: string,
    subgroupId: string,
    reordered: Service[]
  ) => {
    const previousServices = services;
    const reorderedMap = new Map(reordered.map((service, index) => [service.id, index]));

    setServices((prev) =>
      prev.map((service) => {
        if (getServiceGroupId(service) !== groupId || getServiceSubgroupId(service) !== subgroupId) return service;
        const nextIndex = reorderedMap.get(service.id);
        return typeof nextIndex === 'number' ? { ...service, displayOrder: nextIndex } : service;
      })
    );

    setActionMessage(copy.savingOrder);
    try {
      await Promise.all(
        reordered.map((service, index) => updateService(service.id, { displayOrder: index }))
      );
      setActionMessage(null);
    } catch (error: any) {
      setServices(previousServices);
      setActionMessage(error?.message || copy.saveCatalogFailed);
    }
  };

  const reorderSubgroupServicesByDrop = async (
    groupId: string,
    subgroupId: string,
    draggedId: string,
    targetId?: string
  ) => {
    const subgroupServices = services
      .filter((service) => getServiceGroupId(service) === groupId && getServiceSubgroupId(service) === subgroupId)
      .sort(compareServicesByDisplayOrder);
    const currentIndex = subgroupServices.findIndex((service) => service.id === draggedId);
    if (currentIndex === -1) return;

    const reordered = [...subgroupServices];
    const [moved] = reordered.splice(currentIndex, 1);

    if (!targetId) {
      reordered.push(moved);
    } else {
      const targetIndex = reordered.findIndex((service) => service.id === targetId);
      if (targetIndex === -1) return;
      reordered.splice(targetIndex, 0, moved);
    }

    const didChange = reordered.some((service, index) => service.id !== subgroupServices[index]?.id);
    if (!didChange) return;

    await persistSubgroupServiceOrder(groupId, subgroupId, reordered);
  };

  const saveCatalog = async () => {
    setCatalogSaving(true);
    setCatalogMessage(null);
    try {
      const cleanedGroups: ServiceCatalogMainGroup[] = catalogConfig.groups.map((group) => ({
        ...group,
        labelEn: group.labelEn.trim(),
        labelEs: group.labelEs.trim(),
        subgroups: group.subgroups
          .map((subgroup) => ({
            ...subgroup,
            labelEn: subgroup.labelEn.trim(),
            labelEs: subgroup.labelEs.trim(),
          }))
          .filter((subgroup) => subgroup.labelEn || subgroup.labelEs),
      }));

      await saveServiceCatalogConfig({
        id: DEFAULT_SALON_ID,
        salonId: DEFAULT_SALON_ID,
        groups: cleanedGroups,
      });
      setCatalogConfig((prev) => ({ ...prev, groups: cleanedGroups }));
      setCatalogMessage(copy.catalogSaved);
      setCatalogDirty(false);
    } catch (error: any) {
      setCatalogMessage(error?.message || copy.saveCatalogFailed);
    } finally {
      setCatalogSaving(false);
    }
  };

  useEffect(() => {
    if (!catalogConfig.groups.length) return;
    if (!catalogConfig.groups.some((group) => group.id === activeCatalogGroupId)) {
      setActiveCatalogGroupId(catalogConfig.groups[0].id);
    }
  }, [catalogConfig.groups, activeCatalogGroupId]);

  const deleteAllServices = async () => {
    if (!window.confirm(copy.deleteAllServicesConfirm)) return;
    setDeletingAll(true);
    try {
      const assignments = await getEmployeeServices();
      await Promise.all(assignments.map((assignment) => deleteEmployeeService(assignment.id)));
      await Promise.all(services.map((service) => deleteService(service.id)));
      await fetchServices();
      setActionMessage(copy.allServicesDeleted);
    } catch (error: any) {
      setActionMessage(error?.message || copy.deleteAllFailed);
    } finally {
      setDeletingAll(false);
    }
  };

  const copyGeneralBookingLink = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/book`;
    
    try {
      const didCopy = await copyToClipboard(link);
      if (!didCopy) return;
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2000);
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">{copy.title}</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/services/new">
            <button className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all">
              {copy.addService}
            </button>
          </Link>
          <button
            onClick={fetchServices}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
            title={copy.refreshList}
          >
            <svg className={cn("w-5 h-5", loading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <details className="bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">{copy.tools}</p>
            <p className="text-sm text-slate-500 mt-1">{copy.bookingLinkSubtitle}</p>
          </div>
          <span className="text-sm text-slate-500">{copy.tools}</span>
        </summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={copyGeneralBookingLink}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              copiedGeneral
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            {copiedGeneral ? copy.copied : copy.bookingLinkTitle}
          </button>
          <button
            onClick={deleteAllServices}
            disabled={deletingAll || services.length === 0}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              deletingAll || services.length === 0
                ? "bg-slate-100 text-slate-400 border-slate-200"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            )}
          >
            {deletingAll ? copy.deleting : copy.deleteAllServices}
          </button>
        </div>
      </details>

      {actionMessage && (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-700">
          {actionMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">{copy.catalogTitle}</p>
            <button
              type="button"
              onClick={addCatalogGroup}
              className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all"
            >
              {copy.addGroup}
            </button>
          </div>
          {catalogConfig.groups.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 px-4 py-6 text-sm text-slate-500">
              {copy.noGroupsYet}
            </div>
          ) : (
            catalogConfig.groups.map((group) => {
              const isActive = activeCatalogGroup?.id === group.id;
              const groupSection = groupSections.find((section) => section.key === group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveCatalogGroupId(group.id)}
                  className={cn(
                    "w-full rounded-2xl px-4 py-4 text-left transition-all",
                    isActive ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {getCatalogGroupLabel(group, language === 'es' ? 'es' : 'en')}
                  </span>
                  <span className={cn("block text-xs mt-1", isActive ? "text-white/70" : "text-slate-500")}>
                    {group.subgroups.length} {copy.subgroupCount} · {groupSection?.visibleServiceCount || 0} {copy.serviceCount}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          {catalogMessage && <div className="text-sm text-slate-700">{catalogMessage}</div>}
          {orphanedServicesCount > 0 && <div className="text-sm text-amber-800">{copy.missingSubgroupNotice}</div>}

          {activeCatalogGroup ? (
            <>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {getCatalogGroupLabel(activeCatalogGroup, language === 'es' ? 'es' : 'en')}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{copy.catalogSubtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addCatalogSubgroup(activeCatalogGroup.id)}
                    className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all"
                  >
                    {copy.addSubgroup}
                  </button>
                  <button
                    type="button"
                    onClick={saveCatalog}
                    disabled={catalogSaving}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      catalogSaving ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    {catalogSaving ? copy.saving : copy.save}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={activeCatalogGroup.labelEn}
                  onChange={(event) => updateCatalogGroupField(activeCatalogGroup.id, 'labelEn', event.target.value)}
                  placeholder={copy.englishName}
                  className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <input
                  value={activeCatalogGroup.labelEs}
                  onChange={(event) => updateCatalogGroupField(activeCatalogGroup.id, 'labelEs', event.target.value)}
                  placeholder={copy.spanishName}
                  className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-3">
                {groupSections
                  .find((section) => section.key === activeCatalogGroup.id)
                  ?.subgroups.map((subgroup, index) => (
                    <div key={subgroup.key} className="rounded-2xl border border-slate-200 px-4 py-4 space-y-3">
                      {(() => {
                        const subgroupPanelKey = getSubgroupPanelKey(activeCatalogGroup.id, subgroup.key);
                        const isSubgroupOpen = openSubgroups[subgroupPanelKey] ?? false;
                        const subgroupDraft = activeCatalogGroup.subgroups.find((item) => item.id === subgroup.key);
                        const subgroupDisplayName = [subgroupDraft?.labelEn, subgroupDraft?.labelEs]
                          .filter((value): value is string => Boolean(value?.trim()))
                          .filter((value, index, values) => values.indexOf(value) === index)
                          .join(' / ') || subgroup.label;

                        return (
                          <>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="pt-0.5 text-sm font-semibold text-slate-400">{index + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {subgroupDisplayName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>{subgroup.services.length} {copy.serviceCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/dashboard/services/new?group=${activeCatalogGroup.id}&subgroup=${subgroup.key}`}>
                            <button className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all">
                              {copy.addServiceHere}
                            </button>
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubgroups((prev) => ({
                                ...prev,
                                [subgroupPanelKey]: !isSubgroupOpen,
                              }))
                            }
                            className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-all"
                          >
                            {isSubgroupOpen ? copy.closeSubgroup : copy.openSubgroup}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCatalogSubgroup(activeCatalogGroup.id, subgroup.key)}
                            className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 transition-all"
                          >
                            {copy.deleteLabel}
                          </button>
                        </div>
                      </div>

                      {isSubgroupOpen ? (
                        <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={activeCatalogGroup.subgroups.find((item) => item.id === subgroup.key)?.labelEn || ''}
                          onChange={(event) => updateCatalogSubgroupField(activeCatalogGroup.id, subgroup.key, 'labelEn', event.target.value)}
                          placeholder={copy.englishPlaceholder}
                          className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                        <input
                          value={activeCatalogGroup.subgroups.find((item) => item.id === subgroup.key)?.labelEs || ''}
                          onChange={(event) => updateCatalogSubgroupField(activeCatalogGroup.id, subgroup.key, 'labelEs', event.target.value)}
                          placeholder={copy.spanishPlaceholder}
                          className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </div>

                      {subgroup.services.length > 0 ? (
                        <div
                          className="space-y-2"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={async (event) => {
                            event.preventDefault();
                            if (!draggedServiceId) return;
                            setDragOverServiceId(null);
                            await reorderSubgroupServicesByDrop(activeCatalogGroup.id, subgroup.key, draggedServiceId);
                            setDraggedServiceId(null);
                          }}
                        >
                          {subgroup.services.map((service, serviceIndex) => {
                            const isDragging = draggedServiceId === service.id;
                            const isDropTarget = dragOverServiceId === service.id && draggedServiceId !== service.id;

                            return (
                              <div
                                key={service.id}
                                draggable
                                onDragStart={() => {
                                  setDraggedServiceId(service.id);
                                  setDragOverServiceId(service.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedServiceId(null);
                                  setDragOverServiceId(null);
                                }}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (dragOverServiceId !== service.id) {
                                    setDragOverServiceId(service.id);
                                  }
                                }}
                                onDrop={async (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (!draggedServiceId) return;
                                  setDragOverServiceId(null);
                                  await reorderSubgroupServicesByDrop(
                                    activeCatalogGroup.id,
                                    subgroup.key,
                                    draggedServiceId,
                                    service.id
                                  );
                                  setDraggedServiceId(null);
                                }}
                                className={cn(
                                  "flex items-start gap-2 rounded-2xl bg-slate-50 px-2.5 py-2 transition-all sm:items-center sm:gap-3 sm:px-3",
                                  isDragging && "opacity-50",
                                  isDropTarget && "ring-2 ring-slate-300"
                                )}
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-500">
                                  {serviceIndex + 1}
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                                  <button
                                    type="button"
                                    className="max-w-full shrink-0 cursor-grab rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 active:cursor-grabbing"
                                  >
                                    {copy.dragToReorder}
                                  </button>
                                  <Link
                                    href={`/dashboard/services/${service.id}`}
                                    className="min-w-0 flex-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                                  >
                                    <span className="block whitespace-normal break-words leading-snug">{service.serviceName}</span>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">{copy.emptySubgroup}</p>
                      )}
                        </>
                      ) : null}
                          </>
                        );
                      })()}
                    </div>
                  ))}

                {activeCatalogGroup.subgroups.length === 0 && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {copy.noSubgroupsYet}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => deleteCatalogGroup(activeCatalogGroup.id)}
                    className="px-4 py-2 rounded-full bg-rose-50 text-rose-700 text-sm font-medium hover:bg-rose-100 transition-all"
                  >
                    {copy.deleteGroup}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              {copy.noGroupsYet}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
