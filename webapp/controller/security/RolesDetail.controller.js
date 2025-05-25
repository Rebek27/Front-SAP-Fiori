sap.ui.define([
  "com/invertions/sapfiorimodinv/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/base/Log",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment"
], function (BaseController, JSONModel, Log, MessageToast, MessageBox, Fragment) {
  "use strict";

  return BaseController.extend("com.invertions.sapfiorimodinv.controller.security.RolesDetail", {

    onInit: function () {
      const oRouter = this.getRouter();
      oRouter.getRoute("RouteRolesDetail").attachPatternMatched(this._onRouteMatched, this);

      const oProcessModel = this.getOwnerComponent().getModel("processCatalogModel");
      const oPrivilegeModel = this.getOwnerComponent().getModel("privilegeCatalogModel");

      if (oProcessModel) {
        this.getView().setModel(oProcessModel, "processCatalogModel");
      }
      if (oPrivilegeModel) {
        this.getView().setModel(oPrivilegeModel, "privilegeCatalogModel");
      }
    },

    _onRouteMatched: function (oEvent) {
      const sRoleId = decodeURIComponent(oEvent.getParameter("arguments").roleId);

      const oModel = this.getOwnerComponent().getModel("roles");
      if (!oModel) {
        MessageToast.show("Modelo de roles no disponible.");
        return;
      }

      const aRoles = oModel.getProperty("/value");
      const oRole = aRoles.find(role => role.ROLEID === sRoleId);

      if (!oRole) {
        MessageToast.show("Rol no encontrado.");
        return;
      }

      const oSelectedModel = new JSONModel(oRole);
      this.getView().setModel(oSelectedModel, "selectedRole");
    },

    onNavBack: function () {
      const oHistory = sap.ui.core.routing.History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteRolesMaster", {}, true);
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
                const response = await fetch(`${options.url}${oData.ROLEID}`, {
                  method: options.method
                });

                const result = await response.json();

                if (result && !result.error) {
                  MessageToast.show(options.successMessage);
                  const oRolesModel = that.getOwnerComponent().getModel("roles");
                  if (oRolesModel) {
                    const aRoles = oRolesModel.getProperty("/value");
                    const aUpdatedRoles = aRoles.filter(role => role.ROLEID !== oData.ROLEID);
                    oRolesModel.setProperty("/value", aUpdatedRoles);
                  }

                  that.getOwnerComponent().getRouter().navTo("RouteRolesMaster");

                } else {
                  MessageBox.error("Error: " + (result?.message || "desconocido"));
                }
              } catch (error) {
                MessageBox.error("Error en la petición: " + error.message);
              }
            }
          }
        }
      );
    },

    onDesactivateRole: function () {
      this._handleRoleAction({
        dialogType: "confirm",
        message: "¿Estás seguro de que deseas desactivar el rol \"{ROLENAME}\"?",
        title: "Confirmar desactivación",
        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
        emphasizedAction: MessageBox.Action.YES,
        confirmAction: MessageBox.Action.YES,
        method: "POST",
        url: "http://localhost:4004/api/sec/rolesCRUD?procedure=delete&type=logic&roleid=",
        successMessage: "Rol desactivado correctamente."
      });
    },

    onDeleteRole: function () {
      this._handleRoleAction({
        dialogType: "warning",
        message: "¿Estás seguro de que deseas eliminar el rol \"{ROLENAME}\" permanentemente? Esta acción no se puede deshacer.",
        title: "Confirmar eliminación permanente",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        confirmAction: MessageBox.Action.DELETE,
        method: "POST",
        url: "http://localhost:4004/api/sec/rolesCRUD?procedure=delete&type=hard&roleid=",
        successMessage: "Rol eliminado permanentemente."
      });
    },

    onUpdateRole: function () {
      const oView = this.getView();
      const oSelectedRole = oView.getModel("selectedRole").getData();

      const oModel = new JSONModel({
        ROLEID: oSelectedRole.ROLEID,
        ROLENAME: oSelectedRole.ROLENAME,
        DESCRIPTION: oSelectedRole.DESCRIPTION,
        PRIVILEGES: oSelectedRole.PROCESSES.map(proc => ({
          PROCESSID: proc.PROCESSID,
          PRIVILEGEID: proc.PRIVILEGES.map(p => p.PRIVILEGEID)
        })),
        NEW_PROCESSID: "",
        NEW_PRIVILEGES: [],
        IS_EDIT: true
      });
      oView.setModel(oModel, "roleDialogModel");

      const oProcessModel = this.getOwnerComponent().getModel("processCatalogModel");
      const oPrivilegeModel = this.getOwnerComponent().getModel("privilegeCatalogModel");
      if (oProcessModel) oView.setModel(oProcessModel, "processCatalogModel");
      if (oPrivilegeModel) oView.setModel(oPrivilegeModel, "privilegeCatalogModel");

      const oExistingDialog = this.byId("dialogEditRole");
      if (oExistingDialog) {
        oExistingDialog.destroy();
      }

      Fragment.load({
        id: oView.getId(),
        name: "com.invertions.sapfiorimodinv.view.security.fragments.EditRoleDialog",
        controller: this
      }).then(function (oDialog) {
        oView.addDependent(oDialog);
        oDialog.setTitle("Editar Rol");
        oDialog.open();
      });
    },

    onAddPrivilege: function () {
      const oModel = this.getView().getModel("roleDialogModel");
      const oData = oModel.getData();

      if (!oData.NEW_PROCESSID || !Array.isArray(oData.NEW_PRIVILEGES) || oData.NEW_PRIVILEGES.length === 0) {
        MessageToast.show("Selecciona proceso y al menos un privilegio.");
        return;
      }

      oData.PRIVILEGES.push({
        PROCESSID: oData.NEW_PROCESSID,
        PRIVILEGEID: oData.NEW_PRIVILEGES
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

    onSaveRoleEdit: async function () {
      const oData = this.getView().getModel("roleDialogModel").getData();

      if (!oData.ROLEID || !oData.ROLENAME) {
        MessageToast.show("ID y Nombre del Rol son obligatorios.");
        return;
      }

      try {
        const response = await fetch(`http://localhost:4004/api/sec/rolesCRUD?procedure=put&roleid=${oData.ROLEID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ROLEID: oData.ROLEID,
            ROLENAME: oData.ROLENAME,
            DESCRIPTION: oData.DESCRIPTION,
            PRIVILEGES: oData.PRIVILEGES
          })
        });

        if (!response.ok) throw new Error(await response.text());

        MessageToast.show("Rol actualizado correctamente.");

        const oRolesModel = this.getOwnerComponent().getModel("roles");
        const aRoles = oRolesModel.getProperty("/value");
        const index = aRoles.findIndex(role => role.ROLEID === oData.ROLEID);
        if (index !== -1) {
          aRoles[index].ROLENAME = oData.ROLENAME;
          aRoles[index].DESCRIPTION = oData.DESCRIPTION;
          aRoles[index].PRIVILEGES = oData.PRIVILEGES;
          oRolesModel.setProperty("/value", aRoles);
        }

        const oDialog = this.byId("dialogEditRole");
        if (oDialog) {
          oDialog.close();
        }

      } catch (err) {
        MessageBox.error("Error al actualizar el rol: " + err.message);
      }
    }

  });
});