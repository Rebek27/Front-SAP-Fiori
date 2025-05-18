sap.ui.define(
  [
    "com/invertions/sapfiorimodinv/controller/BaseController",

    "sap/ui/model/json/JSONModel",

    "sap/base/Log",

    "sap/m/MessageToast",

    "sap/m/MessageBox",

    "sap/ui/core/Fragment",
  ],

  function (
    BaseController,

    JSONModel,

    Log,

    MessageToast,

    MessageBox,

    Fragment
  ) {
    "use strict";

    return BaseController.extend(
      "com.invertions.sapfiorimodinv.controller.security.RolesDetail",

      {
        _catalogsLoaded: false,

        onInit: function () {
          const oRouter = this.getRouter();

          oRouter

            .getRoute("RouteRolesDetail")

            .attachPatternMatched(this._onRouteMatched, this);

          this.getView().setModel(new JSONModel({}), "selectedRole");

          this.getView().setModel(
            new JSONModel({ values: [] }),

            "processCatalogModel"
          );

          this.getView().setModel(
            new JSONModel({ values: [] }),

            "privilegeCatalogModel"
          );
        },

        _onRouteMatched: async function (oEvent) {
          const sRoleId = decodeURIComponent(
            oEvent.getParameter("arguments").roleId
          );

          this._loadRoleDetails(sRoleId);

          await this._loadCatalogsOnce(); // Cargar los catálogos al activar la ruta

          this._loadUsersByRole(sRoleId); // Asegúrate de que esta línea esté aquí
        },

        _loadCatalogsOnce: async function () {
          if (!this._catalogsLoaded) {
            await this._loadCatalog("IdProcesses", "processCatalogModel");

            await this._loadCatalog("IdPrivileges", "privilegeCatalogModel");

            this._catalogsLoaded = true;
          }
        },

        _loadCatalog: async function (labelId, modelName) {
          const view = this.getView();

          try {
            const response = await fetch(
              "http://localhost:4004/api/security/crudValues?action=get",

              {
                method: "POST",

                headers: { "Content-Type": "application/json" },
              }
            );

            if (!response.ok) {
              const errorText = await response.text();

              Log.error(
                `Error fetching catalog (${labelId}): ${response.status} - ${errorText}`
              );

              MessageBox.error(
                `Error al cargar el catálogo (${labelId}). Por favor, inténtelo de nuevo.`
              );

              return;
            }

            const data = await response.json();

            const filteredValues = data.value.filter(
              (v) => v.LABELID === labelId
            );

            view.setModel(new JSONModel({ values: filteredValues }), modelName);

            Log.info(
              `Catálogo '${labelId}' cargado en el modelo '${modelName}'.`
            );
          } catch (error) {
            Log.error(`Error al cargar el catálogo (${labelId}): ${error}`);

            MessageBox.error(
              `Error al cargar el catálogo (${labelId}). Por favor, revise la consola.`
            );
          }
        },

        onNavBack: function () {
          const oHistory = sap.ui.core.routing.History.getInstance();

          const sPreviousHash = oHistory.getPreviousHash();

          if (sPreviousHash !== undefined) {
            window.history.go(-1);
          } else {
            this.getOwnerComponent()

              .getRouter()

              .navTo("RouteRolesMaster", {}, true);
          }
        },

        _handleRoleAction: async function (options) {
          const oModel = this.getView().getModel("selectedRole");

          const oData = oModel ? oModel.getData() : null;

          const that = this;

          if (!oData || !oData.ROLEID) {
            MessageToast.show("No se encontró el ROLEID.");

            return;
          }

          MessageBox[options.dialogType](
            options.message.replace("{ROLENAME}", oData.ROLENAME),

            {
              title: options.title,

              actions: options.actions,

              emphasizedAction: options.emphasizedAction,

              onClose: async function (oAction) {
                if (oAction === options.confirmAction) {
                  try {
                    const response = await fetch(
                      `${options.url}${oData.ROLEID}`,

                      {
                        method: options.method,
                      }
                    );

                    const result = await response.json();

                    if (result && !result.error) {
                      MessageToast.show(options.successMessage);

                      const oRolesModel = that

                        .getOwnerComponent()

                        .getModel("roles");

                      if (oRolesModel) {
                        const aRoles = oRolesModel.getProperty("/value");

                        const aUpdatedRoles = aRoles.filter(
                          (role) => role.ROLEID !== oData.ROLEID
                        );

                        oRolesModel.setProperty("/value", aUpdatedRoles);
                      }

                      that

                        .getOwnerComponent()

                        .getRouter()

                        .navTo("RouteRolesMaster");
                    } else {
                      MessageBox.error(
                        "Error: " + (result?.message || "desconocido")
                      );
                    }
                  } catch (error) {
                    MessageBox.error("Error en la petición: " + error.message);
                  }
                }
              },
            }
          );
        },

        onDesactivateRole: function () {
          this._handleRoleAction({
            dialogType: "confirm",

            message:
              '¿Estás seguro de que deseas desactivar el rol "{ROLENAME}"?',

            title: "Confirmar desactivación",

            actions: [MessageBox.Action.YES, MessageBox.Action.NO],

            emphasizedAction: MessageBox.Action.YES,

            confirmAction: MessageBox.Action.YES,

            method: "POST",

            url: "http://localhost:4004/api/security/deleteAny?roleid=",

            successMessage: "Rol desactivado correctamente.",
          });
        },

        onDeleteRole: function () {
          this._handleRoleAction({
            dialogType: "warning",

            message:
              '¿Estás seguro de que deseas eliminar el rol "{ROLENAME}" permanentemente? Esta acción no se puede deshacer.',

            title: "Confirmar eliminación permanente",

            actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],

            emphasizedAction: MessageBox.Action.DELETE,

            confirmAction: MessageBox.Action.DELETE,

            method: "POST",

            url: "http://localhost:4004/api/security/deleteAny?borrado=&roleid=",

            successMessage: "Rol eliminado permanentemente.",
          });
        },

        onUpdateRole: function () {
          const oView = this.getView();

          const oSelectedRole = oView.getModel("selectedRole").getData();

          const oModel = new JSONModel({
            ROLEID: oSelectedRole.ROLEID,

            ROLENAME: oSelectedRole.ROLENAME,

            DESCRIPTION: oSelectedRole.DESCRIPTION,

            PRIVILEGES: oSelectedRole.PROCESSES.map((proc) => ({
              PROCESSID: proc.PROCESSID,

              PRIVILEGEID: proc.PRIVILEGES.map((p) => p.PRIVILEGEID),
            })),

            NEW_PROCESSID: "",

            NEW_PRIVILEGES: [],

            IS_EDIT: true,
          });

          oView.setModel(oModel, "roleDialogModel");

          oView.setModel(
            this.getView().getModel("processCatalogModel"),

            "processCatalogModel"
          );

          oView.setModel(
            this.getView().getModel("privilegeCatalogModel"),

            "privilegeCatalogModel"
          );

          const oExistingDialog = this.byId("dialogEditRole");

          if (oExistingDialog) {
            oExistingDialog.destroy();
          }

          Fragment.load({
            id: oView.getId(),

            name: "com.invertions.sapfiorimodinv.view.security.fragments.EditRoleDialog",

            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);

            oDialog.setTitle("Editar Rol");

            oDialog.open();
          });
        },

        onAddPrivilege: function () {
          const oModel = this.getView().getModel("roleDialogModel");

          const oData = oModel.getData();

          if (
            !oData.NEW_PROCESSID ||
            !Array.isArray(oData.NEW_PRIVILEGES) ||
            oData.NEW_PRIVILEGES.length === 0
          ) {
            MessageToast.show("Selecciona proceso y al menos un privilegio.");

            return;
          }

          oData.PRIVILEGES.push({
            PROCESSID: oData.NEW_PROCESSID,

            PRIVILEGEID: oData.NEW_PRIVILEGES,
          });

          oData.NEW_PROCESSID = "";

          oData.NEW_PRIVILEGES = [];

          oModel.setData(oData);
        },

        onRemovePrivilege: function (oEvent) {
          const oModel = this.getView().getModel("roleDialogModel");

          const oData = oModel.getData();

          const oItem = oEvent.getSource().getParent();

          const oContext = oItem.getBindingContext("roleDialogModel");

          const iIndex = oContext.getPath().split("/").pop();

          oData.PRIVILEGES.splice(iIndex, 1);

          oModel.setData(oData);
        },

        _loadRoleDetails: function (sRoleId) {
          const oModel = this.getOwnerComponent().getModel("roles");

          if (oModel) {
            const aRoles = oModel.getProperty("/value");

            const oRole = aRoles.find((role) => role.ROLEID === sRoleId);

            if (oRole) {
              const oSelectedRoleModel =
                this.getView().getModel("selectedRole");

              console.log("_loadRoleDetails: Datos del rol cargados:", oRole);

              oSelectedRoleModel.setData(oRole);

              Log.debug(
                "_loadRoleDetails: Datos iniciales del selectedRole",

                oRole
              );

              console.log(
                "Contenido del modelo processCatalogModel:",

                this.getView().getModel("processCatalogModel").getData()
              ); // Agrega este log
            } else {
              MessageToast.show("Rol no encontrado.");
            }
          } else {
            MessageToast.show("Modelo de roles no disponible.");
          }
        },

        formatProcessName: function (processId) {
          const oProcessCatalog = this.getView().getModel(
            "processCatalogModel"
          );

          if (
            oProcessCatalog &&
            oProcessCatalog.getData() &&
            oProcessCatalog.getData().values
          ) {
            const oProcess = oProcessCatalog

              .getData()

              .values.find((item) => item.VALUEID === processId);

            return oProcess ? oProcess.DESCRIPTION : "";
          }

          return "";
        },

        formatProcessApplication: function (processId) {
          const oProcessCatalog = this.getView().getModel(
            "processCatalogModel"
          );

          if (
            oProcessCatalog &&
            oProcessCatalog.getData() &&
            oProcessCatalog.getData().values
          ) {
            const oProcess = oProcessCatalog

              .getData()

              .values.find((item) => item.VALUEID === processId);

            if (oProcess && oProcess.VALUE) {
              const parts = oProcess.VALUE.split("-"); // Asume que la aplicación está antes del primer guion

              return parts.length > 0 ? parts[0] : "";
            }
          }

          return "";
        },

        formatProcessView: function (processId) {
          const oProcessCatalog = this.getView().getModel(
            "processCatalogModel"
          );

          if (
            oProcessCatalog &&
            oProcessCatalog.getData() &&
            oProcessCatalog.getData().values
          ) {
            const oProcess = oProcessCatalog

              .getData()

              .values.find((item) => item.VALUEID === processId);

            if (oProcess && oProcess.VALUEPAID) {
              const parts = oProcess.VALUEPAID.split("-"); // Asumimos que la vista está después del primer guion

              return parts.length > 1 ? parts[1] : "";
            }
          }

          return "";
        },

        onSaveRoleEdit: async function () {
          const oData = this.getView().getModel("roleDialogModel").getData();

          if (!oData.ROLEID || !oData.ROLENAME) {
            MessageToast.show("ID y Nombre del Rol son obligatorios.");

            return;
          }

          try {
            const response = await fetch(
              `http://localhost:4004/api/security/crudRoles?action=update&roleid=${oData.ROLEID}`,

              {
                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({
                  roles: {
                    ROLENAME: oData.ROLENAME,

                    DESCRIPTION: oData.DESCRIPTION,

                    PRIVILEGES: oData.PRIVILEGES.map((privilege) => ({
                      PROCESSID: privilege.PROCESSID,

                      PRIVILEGEID: Array.isArray(privilege.PRIVILEGEID)
                        ? privilege.PRIVILEGEID
                        : [privilege.PRIVILEGEID],
                    })),
                  },
                }),
              }
            );

            if (!response.ok) throw new Error(await response.text());

            const updatedData = await response.json(); // Obtén la respuesta del backend

            MessageToast.show("Rol actualizado correctamente.");

            const oSelectedRoleModel = this.getView().getModel("selectedRole");

            let updatedRoleDetails;

            if (updatedData?.role) {
              updatedRoleDetails = updatedData.role;
            } else {
              // Si la respuesta no devuelve el rol actualizado, recarga los detalles

              await this._loadRoleDetails(oData.ROLEID);

              updatedRoleDetails = this.getView()

                .getModel("selectedRole")

                .getData();
            } // Actualiza el modelo selectedRole *después* de obtener los datos actualizados

            oSelectedRoleModel.setData(updatedRoleDetails);

            console.log(
              "Modelo 'selectedRole' después de guardar:",

              oSelectedRoleModel.getData()
            ); // Intenta forzar la actualización del binding de la tabla

            const oProcessesTable = this.byId("processesTable");

            if (oProcessesTable) {
              const oBinding =
                oProcessesTable.getBinding("rows") ||
                oProcessesTable.getBinding("items");

              if (oBinding) {
                oBinding.refresh();

                console.log("Binding de la tabla refrescado.");
              } else {
                console.log("No se encontró el binding de la tabla.");
              }
            } else {
              console.log("No se encontró la tabla con ID 'processesTable'.");
            }

            const oDialog = this.byId("dialogEditRole");

            if (oDialog) {
              oDialog.close();
            }
          } catch (err) {
            MessageBox.error("Error al actualizar el rol: " + err.message);
          }
        },

        _loadUsersByRole: async function (sRoleId) {
          console.log(
            "_loadUsersByRole: Función llamada para el rol ID:",

            sRoleId
          );

          try {
            if (!sRoleId) {
              Log.warning("_loadUsersByRole llamado sin un ID de rol.");

              return;
            }

            const response = await fetch(
              `http://localhost:4004/api/security/crudRoles?action=getUsByRo&roleid=${sRoleId}`,

              { method: "POST" } // Ajusta a GET si tu backend lo requiere
            );

            if (!response.ok) {
              const errorText = await response.text();

              Log.error(
                `Error fetching users for role ID ${sRoleId}: ${response.status} - ${errorText}`
              );

              MessageBox.error(
                `Error al cargar los usuarios para este rol: ${errorText}`
              );

              return;
            }

            const data = await response.json();

            const aUsers = data || []; // Asume que la respuesta es un array de usuarios // Obtén el modelo 'selectedRole' de la vista

            const oSelectedRoleModel = this.getView().getModel("selectedRole"); // Verifica si el modelo existe y actualiza la propiedad 'USERS'

            if (oSelectedRoleModel) {
              oSelectedRoleModel.setProperty("/USERS", aUsers);

              Log.info(
                `Usuarios para el rol con ID ${sRoleId} cargados en el modelo.`
              );

              console.log("_loadUsersByRole: Usuarios cargados:", aUsers);

              console.log(
                "Modelo selectedRole después de actualizar USERS:",

                oSelectedRoleModel.getData()
              );
            } else {
              Log.warning(
                "El modelo 'selectedRole' no está disponible para actualizar los usuarios."
              ); // Esto podría indicar un problema en la inicialización del modelo

              console.log("Modelo selectedRole no encontrado.");
            }
          } catch (error) {
            Log.error(
              `Error al cargar los usuarios para el rol con ID ${sRoleId}:`,

              error
            );

            MessageBox.error(
              "Error al cargar los usuarios para este rol. Por favor, revise la consola."
            );
          }
        },

        onDialogClose: function () {
          const oDialog = this.byId("dialogEditRole");

          if (oDialog) {
            oDialog.close();
          }
        },
      }
    );
  }
);
