sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat",
    "sap/m/MessageBox",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
  ],
  function (
    Controller,
    JSONModel,
    MessageToast,
    DateFormat,
    MessageBox,
    VizFrame,
    FlattenedDataset,
    FeedItem
  ) {
    "use strict";

    return Controller.extend(
      "com.invertions.sapfiorimodinv.controller.investments.Investments",
      {
        _oResourceBundle: null,
        _bSidebarExpanded: true,
        _sSidebarOriginalSize: "380px",

        onInit: function () {
          // 1. Modelo para los símbolos (datos estáticos por ahora)
          this._initSymbolModel();

          // 2. Modelo para la tabla (vacío)
          this.getView().setModel(
            new JSONModel({
              value: [],
            }),
            "priceData"
          );

          // 3. Configurar gráfica
          this.getView().addEventDelegate({
            onAfterRendering: this._onViewAfterRendering.bind(this),
          });

          var oViewModel = new sap.ui.model.json.JSONModel({
            selectedTab: "table",
          });
          this.getView().setModel(oViewModel, "viewModel");

          // Inicializar el modelo de análisis
          var oStrategyAnalysisModelData = {
            balance: 1000,
            stock: 1,
            strategyKey: "",
            longSMA: 200,
            shortSMA: 50,
            startDate: null,
            endDate: null,
            controlsVisible: false,
            strategies: [
              { key: "", text: "Cargando textos..." },
              { key: "MACrossover", text: "Cargando textos..." },
            ],
          };
          var oStrategyAnalysisModel = new JSONModel(
            oStrategyAnalysisModelData
          );
          this.getView().setModel(
            oStrategyAnalysisModel,
            "strategyAnalysisModel"
          );

          // Modelo historial de inversiones
          this.getView().setModel(
            new JSONModel({
              strategies: [
                {
                  date: new Date(2024, 4, 15), // Mayo 15, 2024
                  strategyName: "Moving Average Crossover 1",
                  symbol: "AAPL",
                  result: 2500.5,
                  status: "Completado",
                },
                {
                  date: new Date(2024, 4, 16), // Mayo 16, 2024
                  strategyName: "Moving Average Crossover 2",
                  symbol: "TSLA",
                  result: -1200.3,
                  status: "Completado",
                },
                {
                  date: new Date(2024, 4, 17), // Mayo 17, 2024
                  strategyName: "Moving Average Crossover 3",
                  symbol: "MSFT",
                  result: 3400.8,
                  status: "En Proceso",
                },
              ],
              filteredCount: 0,
              selectedCount: 0,
              filters: {
                dateRange: null,
                investmentRange: [0, 10000],
                profitRange: [-100, 100],
              },
            }),
            "historyModel"
          );

          //Inicialización modelo de resultados
          var oStrategyResultModel = new JSONModel({
            hasResults: false,
            idSimulation: null,
            signal: null,
            date_from: null,
            date_to: null,
            moving_averages: { short: null, long: null },
            signals: [],
            chart_data: {},
            result: null,
          });
          this.getView().setModel(oStrategyResultModel, "strategyResultModel");

          this._setDefaultDates();

          // Cargar el ResourceBundle
          var oI18nModel = this.getOwnerComponent().getModel("i18n");
          if (oI18nModel) {
            try {
              var oResourceBundle = oI18nModel.getResourceBundle();
              if (
                oResourceBundle &&
                typeof oResourceBundle.getText === "function"
              ) {
                this._oResourceBundle = oResourceBundle;
                oStrategyAnalysisModel.setProperty("/strategies", [
                  {
                    key: "",
                    text: this._oResourceBundle.getText(
                      "selectStrategyPlaceholder"
                    ),
                  },
                  {
                    key: "MACrossover",
                    text: this._oResourceBundle.getText(
                      "movingAverageCrossoverStrategy"
                    ),
                  },
                  {
                    key: "Reversión Simple",
                    text: this._oResourceBundle.getText(
                      "movingAverageReversionSimpleStrategy"
                    ),
                  },
                ]);
                console.log("Textos de i18n cargados correctamente.");
              } else {
                throw new Error("ResourceBundle no válido");
              }
            } catch (error) {
              console.error("Error al cargar ResourceBundle:", error);
              oStrategyAnalysisModel.setProperty("/strategies", [
                { key: "", text: "Error i18n: Seleccione..." },
                { key: "MACrossover", text: "Error i18n: Cruce Medias..." },
              ]);
            }
          } else {
            console.error(
              "Modelo i18n no encontrado. Usando textos por defecto."
            );
            oStrategyAnalysisModel.setProperty("/strategies", [
              { key: "", text: "No i18n: Seleccione..." },
              { key: "MACrossover", text: "No i18n: Cruce Medias..." },
            ]);
          }

          // Para el tamaño del Sidebar
          var oSidebarLayoutData = this.byId("sidebarLayoutData");
          if (oSidebarLayoutData) {
            this._sSidebarOriginalSize = oSidebarLayoutData.getSize();
          } else {
            var oSidebarVBox = this.byId("sidebarVBox");
            if (oSidebarVBox && oSidebarVBox.getLayoutData()) {
              this._sSidebarOriginalSize = oSidebarVBox
                .getLayoutData()
                .getSize();
            }
          }
        },
        onTabSelect: function (oEvent) {
          var sKey = oEvent.getParameter("key");
          this.getView()
            .getModel("viewModel")
            .setProperty("/selectedTab", sKey);
        },

        _onViewAfterRendering: function () {
          this._configureChart();
        },

        _initSymbolModel: function () {
          const oSymbolModel = new JSONModel({
            symbols: [
              { symbol: "TSLA", name: "Tesla" },
              { symbol: "AAPL", name: "Apple" },
              { symbol: "MSFT", name: "Microsoft" },
              { symbol: "IBM", name: "IBM" },
            ],
          });
          this.getView().setModel(oSymbolModel, "symbolModel");
        },

        /* onSymbolChange: function(oEvent) {
        const sSymbol = oEvent.getSource().getSelectedKey();
        this._loadPriceData(sSymbol).then(aData => {
            const oPriceModel = this.getView().getModel("priceData");
            oPriceModel.setProperty("/originalValue", aData); // Guarda los datos originales
            oPriceModel.setProperty("/value", aData); // Muestra los datos en la gráfica
        }).catch(error => {
            console.error("Error al cargar los datos del símbolo:", error.message);
        });
    }, */
        _transformDataForVizFrame: function (aApiData) {
          if (!aApiData || !Array.isArray(aApiData)) {
            return [];
          }
          return aApiData.map((oItem) => {
            let dateValue = oItem.DATE || oItem.date;

            let closeValue = parseFloat(oItem.CLOSE || oItem.close);
            if (isNaN(closeValue)) closeValue = null;

            return {
              DATE: dateValue,
              OPEN: parseFloat(oItem.OPEN) || null,
              HIGH: parseFloat(oItem.HIGH) || null,
              LOW: parseFloat(oItem.LOW) || null,
              CLOSE: closeValue,
              VOLUME: parseFloat(oItem.VOLUME) || null,
            };
          });
        },

        _configureChart: function () {
          const oVizFrame = this.byId("idVizFrame");
          if (!oVizFrame) {
            console.warn(
              "Función _configureChart: VizFrame con ID 'idVizFrame' no encontrado en este punto del ciclo de vida."
            );
            return;
          }

          oVizFrame.setVizProperties({
            plotArea: {
              dataLabel: { visible: false },
              window: {
                start: null,
                end: null,
              },
            },
            valueAxis: {
              title: { text: "Precio de Cierre (USD)" },
            },
            timeAxis: {
              title: { text: "Fecha" },
              levels: ["day", "month", "year"],
              label: {
                formatString: "dd/MM/yy",
              },
            },
            title: {
              text: "Histórico de Precios de Acciones",
            },
            legend: {
              visible: true,
            },
            toolTip: {
              visible: true,
              formatString: "#,##0.00",
            },
            interaction: {
              zoom: {
                enablement: "enabled",
              },
              selectability: {
                mode: "single",
              },
            },
          });
          console.log(
            "Propiedades de VizFrame configuradas para permitir zoom."
          );
        },

        // PANEL DE ESTRATEGIAS
        _setDefaultDates: function () {
          var oStrategyAnalysisModel = this.getView().getModel(
            "strategyAnalysisModel"
          );
          var oToday = new Date();
          oStrategyAnalysisModel.setProperty("/endDate", new Date(oToday));
          var oStartDate = new Date(oToday);
          oStartDate.setMonth(oStartDate.getMonth() - 6);
          oStrategyAnalysisModel.setProperty(
            "/startDate",
            new Date(oStartDate)
          );
        },

        onStrategyChange: function (oEvent) {
          var oStrategyAnalysisModel = this.getView().getModel(
            "strategyAnalysisModel"
          );
          var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
          oStrategyAnalysisModel.setProperty(
            "/controlsVisible",
            !!sSelectedKey
          );
        },

        onRunAnalysisPress: function () {
          var oView = this.getView();
          var oStrategyModel = oView.getModel("strategyAnalysisModel");
          var oResultModel = oView.getModel("strategyResultModel");
          var oAnalysisPanel =
            this.byId("strategyAnalysisPanelTable")?.byId(
              "strategyAnalysisPanel"
            ) ||
            this.byId("strategyAnalysisPanelChart")?.byId(
              "strategyAnalysisPanel"
            );
          var oResultPanel =
            this.byId("strategyResultPanel") ||
            sap.ui.getCore().byId("strategyResultPanel");
          var sSymbol = oView.byId("symbolSelector").getSelectedKey();

          // Validaciones básicas
          if (!oStrategyModel.getProperty("/strategyKey")) {
            MessageBox.warning("Seleccione una estrategia");
            return;
          }
          if (!sSymbol) {
            MessageBox.warning("Seleccione un símbolo (ej: AAPL)");
            return;
          }

          if (oAnalysisPanel) {
            oAnalysisPanel.setExpanded(false);
          }

          var strategy = this.getView()
            .getModel("strategyAnalysisModel")
            .getProperty("/strategyKey");
          // Expande el panel de resultados
          if (oResultPanel) {
            oResultPanel.setExpanded(true);
          }

          if (strategy === "Reversión Simple") {
            strategy = "reversionsimple";
          }

          var SPECS = "";

          if (strategy === "reversionsimple") {
            const rsi = this.getView()
              .getModel("strategyAnalysisModel")
              .getProperty("/rsi");

            SPECS = [
              {
                INDICATOR: "rsi",
                VALUE: rsi,
              },
            ];

            console.log(SPECS); // Opcional: para verificar que se armó correctamente
          } else {
            SPECS = [
              {
                INDICATOR: "SHORT_MA",
                VALUE: oStrategyModel.getProperty("/shortSMA"), // Asegúrate de que el tipo de dato sea correcto (número si lo esperas como número)
              },
              {
                INDICATOR: "LONG_MA",
                VALUE: oStrategyModel.getProperty("/longSMA"), // Asegúrate de que el tipo de dato sea correcto
              },
            ];
          }

          // Configurar petición
          var oRequestBody = {
            SIMULATION: {
              SYMBOL: sSymbol,
              STARTDATE: this._formatDate(
                oStrategyModel.getProperty("/startDate")
              ),
              ENDDATE: this._formatDate(oStrategyModel.getProperty("/endDate")),
              AMOUNT: this.getView()
                .getModel("strategyAnalysisModel")
                .getProperty("/stock"),
              USERID: "ARAMIS",
              SPECS: SPECS,
            },
          };

          // Llamada a la API
          const PORT = 4004;

          fetch(
            `http://localhost:${PORT}/api/inv/simulation?strategy=${strategy}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(oRequestBody),
            }
          )
            .then((response) =>
              response.ok ? response.json() : Promise.reject(response)
            )
            .then((data) => {
              console.log("Datos recibidos:", data);

              // Guardar datos en el modelo
              oResultModel.setData({
                hasResults: true,
                chart_data: this._prepareTableData(
                  data.value?.[0]?.CHART_DATA || [],
                  data.value?.[0]?.SIGNALS || []
                ),
                signals: data.value?.[0]?.SIGNALS || [],
                result: data.value?.[0]?.result || 0,
              });

              // Sumar la ganancia al balance
              var oStrategyModel = this.getView().getModel(
                "strategyAnalysisModel"
              );
              var currentBalance = oStrategyModel.getProperty("/balance") || 0;
              var gainPerShare = data.value.result || 0;
              var stock = oStrategyModel.getProperty("/stock") || 1;
              var totalGain = +(gainPerShare * stock).toFixed(2);
              oStrategyModel.setProperty(
                "/balance",
                currentBalance + totalGain
              );
              MessageToast.show(
                "Se añadieron $" + totalGain + " a tu balance."
              );
            })
            .catch((error) => {
              console.error("Error:", error);
              MessageBox.error("Error al obtener datos de simulación");
            });
        },

        // Función auxiliar para formatear fechas
        _formatDate: function (oDate) {
          return oDate
            ? DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).format(
                oDate
              )
            : null;
        },

        // Función auxiliar para preparar datos para la tabla
        _prepareTableData: function (aData, aSignals) {
          if (!Array.isArray(aData)) return [];

          return aData.map((oItem, index) => {
            const signal = aSignals[index] || {};
            return {
              DATE: oItem.DATE,
              OPEN: oItem.OPEN,
              HIGH: oItem.HIGH,
              LOW: oItem.LOW,
              CLOSE: oItem.CLOSE,
              VOLUME: oItem.VOLUME,
              INDICATORS:
                oItem.INDICATORS?.[0]?.VALUE != null
                  ? "SMA: " + oItem.INDICATORS[0].VALUE
                  : "N/A",
              SIGNALS: signal.TYPE ? "ACCIÓN " + signal.TYPE : "SIN ACCIÓN",
              RULES: signal.REASONING
                ? "RAZÓN " + signal.REASONING
                : "SIN RAZÓN",
              SHARES: signal.SHARES ? signal.SHARES : 0,
            };
          });
        },

        onRefreshChart: function () {
          const oSymbolModel = this.getView().getModel("symbolModel");
          const sCurrentSymbol = oSymbolModel.getProperty("/selectedSymbol");

          if (sCurrentSymbol) {
            // Refresca los datos de la tabla y el gráfico
            this._loadPriceData(sCurrentSymbol);
          } else {
            const aSymbols = oSymbolModel.getProperty("/symbols");
            if (aSymbols && aSymbols.length > 0) {
              const sDefaultSymbol = aSymbols[0].symbol;
              oSymbolModel.setProperty("/selectedSymbol", sDefaultSymbol);
              this._loadPriceData(sDefaultSymbol);
            } else {
              MessageToast.show("Por favor, seleccione un símbolo.");
            }
          }
        },

        onDataPointSelect: function (oEvent) {
          const oData = oEvent.getParameter("data");
          console.log("Datos seleccionados:", oData);

          if (oData && oData.length > 0) {
            const oSelectedData = oData[0];
            console.log("Datos del punto seleccionado:", oSelectedData);

            const sFecha = oSelectedData.data.DATE;
            const fPrecioCierre = oSelectedData.data.CLOSE;

            if (sFecha && fPrecioCierre !== undefined) {
              const oViewModel = this.getView().getModel("viewModel");
              oViewModel.setProperty("/selectedPoint", {
                DATE: sFecha,
                CLOSE: fPrecioCierre,
              });
            } else {
              console.warn(
                "Los datos seleccionados no contienen DATE o CLOSE."
              );
            }
          } else {
            console.warn("No se seleccionaron datos.");
          }
        },

        //Historial de inversiones
        onHistoryPress: function (oEvent) {
          if (!this._oHistoryPopover) {
            this._oHistoryPopover = sap.ui.xmlfragment(
              "com.invertions.sapfiorimodinv.view.investments.fragments.InvestmentHistoryPanel",
              this
            );
            this.getView().addDependent(this._oHistoryPopover);
          }

          if (this._oHistoryPopover.isOpen()) {
            this._oHistoryPopover.close();
            return;
          }

          // Abrir la ventana
          this._oHistoryPopover.openBy(oEvent.getSource());
        },

        // ******** FILTRO ********** //
        onToggleAdvancedFilters: function () {
          if (!this._oHistoryPopover) return;

          // Get panel directly from popover content
          const oPanel = sap.ui.getCore().byId("advancedFiltersPanel");

          if (oPanel) {
            oPanel.setVisible(!oPanel.getVisible());
          } else {
            console.warn("Advanced filters panel not found");
          }
        },

        // Método del Sidebar
        // onToggleSidebarPress: function() {
        //     var oSidebarLayoutData = this.byId("sidebarLayoutData");

        //     if (oSidebarLayoutData) {
        //         if (this._bSidebarExpanded) {
        //             this._sSidebarOriginalSize = oSidebarLayoutData.getSize();
        //             oSidebarLayoutData.setSize("0px");
        //         } else {
        //             oSidebarLayoutData.setSize(this._sSidebarOriginalSize);
        //         }
        //         this._bSidebarExpanded = !this._bSidebarExpanded;

        //         var oButton = this.byId("toggleSidebarButton");
        //         if (oButton) {
        //             oButton.setIcon(this._bSidebarExpanded ? "sap-icon://menu2" : "sap-icon://open-command-field");
        //         }
        //     } else {
        //         console.error("No se pudo encontrar sidebarLayoutData para plegar/desplegar.");
        //     }
        // },

        // onTimeIntervalChange: function(oEvent) {
        //     const sKey = oEvent.getParameter("selectedItem").getKey();
        //     const oPriceModel = this.getView().getModel("priceData");
        //     const aOriginalData = oPriceModel.getProperty("/originalValue"); // Datos originales
        //     const aData = aOriginalData || []; // Usa los datos originales si están disponibles

        //     if (!aData || aData.length === 0) {
        //         MessageToast.show("No hay datos originales disponibles para filtrar.");
        //         return;
        //     }

        //     // Calcula la fecha de inicio según el intervalo seleccionado
        //     const oEndDate = new Date();
        //     let oStartDate;
        //     switch (sKey) {
        //         case "1D": // Último día
        //             oStartDate = new Date(oEndDate);
        //             oStartDate.setDate(oEndDate.getDate() - 1);
        //             break;
        //         case "1W": // Última semana
        //             oStartDate = new Date(oEndDate);
        //             oStartDate.setDate(oEndDate.getDate() - 7);
        //             break;
        //         case "1M": // Último mes
        //             oStartDate = new Date(oEndDate);
        //             oStartDate.setMonth(oEndDate.getMonth() - 1);
        //             break;
        //         case "1Y": // Último año
        //             oStartDate = new Date(oEndDate);
        //             oStartDate.setFullYear(oEndDate.getFullYear() - 1);
        //             break;
        //         case "ALL": // Historial completo
        //         default:
        //             oStartDate = null; // No filtrar
        //             break;
        //     }

        //     // Filtra los datos según el intervalo
        //     const oDateFormat = DateFormat.getDateInstance({ pattern: "MM/dd/yyyy" });
        //     const aFilteredData = oStartDate
        //         ? aData.filter(oItem => {
        //             const oItemDate = new Date(oItem.DATE); // Usa new Date() para convertir la fecha
        //             return oItemDate >= oStartDate && oItemDate <= oEndDate;
        //         })
        //         : aData;

        //     if (aFilteredData.length === 0) {
        //         MessageToast.show("No hay datos disponibles para el intervalo seleccionado.");
        //         oPriceModel.setProperty("/value", aOriginalData); // Restaura los datos originales
        //         return;
        //     }

        //     // Actualiza el modelo con los datos filtrados
        //     console.log("Datos filtrados:", aFilteredData);
        //     oPriceModel.setProperty("/value", aFilteredData);
        // }
      }
    );
  }
);
