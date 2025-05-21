sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("com.invertions.sapfiorimodinv.controller.App", {

    onInit: function () {
      // Redirige automáticamente a la vista principal al iniciar
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.navTo("Login");
    },


    onToggleSideNav: function () {
      const oToolPage = this.byId("mainToolPage");
      oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
    },

    onItemSelect: function (oEvent) {
      const sKey = oEvent.getParameter("item").getKey();
      const oRouter = this.getOwnerComponent().getRouter();
      const isLoggedIn = this.getOwnerComponent().getModel("appView").getProperty("/isLoggedIn");

      if (!isLoggedIn) {
        MessageToast.show("Debe iniciar sesión para acceder");
        return;
      }

      switch (sKey) {
        case "roles":
          oRouter.navTo("RouteRoles");
          break;
        case "users":
          oRouter.navTo("RouteUsersList");
          break;
        case "catalogs":
          oRouter.navTo("RouteCatalogs");
          break;
        case "invertions":
          oRouter.navTo("RouteInvestments");
          break;
        default:
          oRouter.navTo("RouteMain");
      }
    }


  });
});
