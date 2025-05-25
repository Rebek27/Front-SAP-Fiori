/* eslint-disable linebreak-style */
/* eslint-disable no-console */
sap.ui.define([
    "com/invertions/sapfiorimodinv/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log"
], function(BaseController,JSONModel,Log){
    "use strict";

    return BaseController.extend("com.invertions.sapfiorimodinv.controller.security.UserDetails",{
        onInit: function(){
			const oRouter = this.getRouter();

			oRouter.getRoute("RouteUserDetails").attachPatternMatched(this._onRouteMatched,this);
        },
		_onRouteMatched: async function(oEvent){
			const sUserId = oEvent.getParameter("arguments").USERID;
			console.log("sUserID",sUserId);
			const oSelectedUser = this.getOwnerComponent().getModel("selectedUser");

			if (!oSelectedUser) {
				Log.error("No hay modelo 'selectedUser'.");
				return;
			}

			const oData = oSelectedUser.getData();
			
			if(oData && oData.USERID === sUserId){
				this.getView().setModel(oSelectedUser, "selectedUser");
				this.getView().bindElement({ path: "/", model: "selectedUser" });
			}else{
				Log.warning("El Usuario seleccionado no coincide con el ID Recibido");
			}
		}
    });
});