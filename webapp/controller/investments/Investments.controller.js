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

        /**
         * Lifecycle hook that is called when the controller is initialized.
         * Initializes models, sets default dates, and configures event delegates.
         */
        onInit: function () {
          // 1. Initialize Symbol Model (static data for now)
          this._initSymbolModel();

          // 2. Initialize Price Data Model (empty for now)
          this.getView().setModel(
            new JSONModel({
              value: [],
            }),
            "priceData"
          );

          // 3. Add event delegate for VizFrame configuration after rendering
          this.getView().addEventDelegate({
            onAfterRendering: this._onViewAfterRendering.bind(this),
          });

          // 4. Initialize ViewModel for UI state (e.g., selected tab)
          var oViewModel = new sap.ui.model.json.JSONModel({
            selectedTab: "table",
          });
          this.getView().setModel(oViewModel, "viewModel");

          // 5. Initialize Strategy Analysis Model
          var oStrategyAnalysisModelData = {
            balance: 1000,
            stock: 1,
            longSMA: 200,
            shortSMA: 50,
            rsi: 14, // Default RSI value
            startDate: null,
            endDate: null,
            controlsVisible: false,
            strategies: [
              { key: "", text: "Cargando textos..." }, // Placeholder for i18n
              { key: "MACrossover", text: "Cargando textos..." },
              { key: "Reversión Simple", text: "Cargando textos..." },
            ],
            // IMPORTANT: Initialize as an ARRAY of strings for VizFrame FeedItem
            chartMeasuresFeed: ["PrecioCierre", "Señal BUY", "Señal SELL"],
          };
          var oStrategyAnalysisModel = new JSONModel(
            oStrategyAnalysisModelData
          );
          this.getView().setModel(
            oStrategyAnalysisModel,
            "strategyAnalysisModel"
          );

          // 6. Initialize Investment History Model
          this.getView().setModel(
            new JSONModel({
              strategies: [
                {
                  date: new Date(2024, 4, 15),
                  strategyName: "Moving Average Crossover 1",
                  symbol: "AAPL",
                  result: 2500.5,
                  status: "Completado",
                },
                {
                  date: new Date(2024, 4, 16),
                  strategyName: "Moving Average Crossover 2",
                  symbol: "TSLA",
                  result: -1200.3,
                  status: "Completado",
                },
                {
                  date: new Date(2024, 4, 17),
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

          // 7. Initialize Strategy Result Model
          var oStrategyResultModel = new JSONModel({
            hasResults: false,
            idSimulation: null,
            signal: null,
            date_from: null,
            date_to: null,
            moving_averages: { short: null, long: null },
            signals: [],
            chart_data: [], // Initialize as empty array
            result: null,
            // Propiedades para el resumen de simulación (ahora vienen de la API)
            simulationName: "",
            symbol: "",
            startDate: null,
            endDate: null,
            TOTAL_BOUGHT_UNITS: 0,
            TOTAL_SOLD_UNITS: 0,
            REMAINING_UNITS: 0,
            FINAL_CASH: 0,
            FINAL_VALUE: 0,
            FINAL_BALANCE: 0,
            REAL_PROFIT: 0,
            PERCENTAGE_RETURN: 0, // Nueva propiedad
          });
          this.getView().setModel(oStrategyResultModel, "strategyResultModel");

          // 8. Set default date range for analysis
          this._setDefaultDates();

          // 9. Load ResourceBundle for i18n texts
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
                {
                  key: "Reversión Simple",
                  text: "Error i18n: Reversion Simple...",
                },
              ]);
            }
          } else {
            console.error(
              "Modelo i18n no encontrado. Usando textos por defecto."
            );
            oStrategyAnalysisModel.setProperty("/strategies", [
              { key: "", text: "No i18n: Seleccione..." },
              { key: "MACrossover", text: "No i18n: Cruce Medias..." },
              { key: "Reversión Simple", text: "No i18n: Reversion Simple..." },
            ]);
          }

          // 10. Store original sidebar size
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

          // 11. Call function to initialize chart measures feed based on initial strategy
          this._updateChartMeasuresFeed();
        },

        /**
         * Event handler for tab selection.
         * @param {sap.ui.base.Event} oEvent The event object
         */
        onTabSelect: function (oEvent) {
          var sKey = oEvent.getParameter("key");
          this.getView()
            .getModel("viewModel")
            .setProperty("/selectedTab", sKey);
        },

        /**
         * Event handler for after rendering of the view.
         * Configures the VizFrame once it's rendered.
         * @private
         */
        _onViewAfterRendering: function () {
          this._configureChart();
        },

        /**
         * Initializes the symbol model with static data.
         * @private
         */
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

        /**
         * Configures the properties of the VizFrame.
         * @private
         */
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
              title: { text: "Precio (USD)" }, // Generalize title as it will show various measures
            },
            timeAxis: {
              title: { text: "Fecha" },
              levels: ["day", "month", "year"],
              label: {
                formatString: "dd/MM/yy",
              },
            },
            title: {
              text: "Análisis de Precios e Indicadores",
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

        /**
         * Sets default start and end dates for the analysis.
         * @private
         */
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

        /**
         * Event handler for strategy selection change.
         * Updates visible controls and chart measures.
         * @param {sap.ui.base.Event} oEvent The event object
         */
        onStrategyChange: function (oEvent) {
          var oStrategyAnalysisModel = this.getView().getModel(
            "strategyAnalysisModel"
          );
          var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
          oStrategyAnalysisModel.setProperty(
            "/controlsVisible",
            !!sSelectedKey
          );
          // Update strategyKey in the model
          oStrategyAnalysisModel.setProperty("/strategyKey", sSelectedKey);
          this._updateChartMeasuresFeed();
          // Call function to update chart measures feed based on new strategy
        },

        /**
         * Event handler for running the analysis.
         * Makes an API call to get simulation data and updates models.
         * It also triggers the update of chart measures feed after data is loaded.
         */
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
          var oResultPanel = this.byId("strategyResultPanel"); // Ensure this ID is correct

          var sSymbol = oView.byId("symbolSelector").getSelectedKey();

          // Basic validations
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

          var strategy = oStrategyModel.getProperty("/strategyKey");
          // Expand results panel
          if (oResultPanel) {
            oResultPanel.setExpanded(true);
          }

          // Adjust strategy name for API call if necessary
          let apiStrategyName = strategy; // Usamos una variable para el nombre de la API
          if (strategy === "Reversión Simple") {
            apiStrategyName = "reversionsimple";
          }

          var SPECS = []; // Initialize as array

          if (apiStrategyName === "reversionsimple") {
            const rsi = oStrategyModel.getProperty("/rsi");
            SPECS = [
              {
                INDICATOR: "rsi",
                VALUE: rsi,
              },
            ];
          } else {
            // Default for MACrossover or any other strategy
            SPECS = [
              {
                INDICATOR: "SHORT_MA",
                VALUE: oStrategyModel.getProperty("/shortSMA"),
              },
              {
                INDICATOR: "LONG_MA",
                VALUE: oStrategyModel.getProperty("/longSMA"),
              },
            ];
          }

          // Configure request body
          var oRequestBody = {
            SIMULATION: {
              SYMBOL: sSymbol,
              STARTDATE: this.formatDate(
                // Usar el formateador público
                oStrategyModel.getProperty("/startDate")
              ),
              ENDDATE: this.formatDate(oStrategyModel.getProperty("/endDate")), // Usar el formateador público
              AMOUNT: oStrategyModel.getProperty("/stock"),
              USERID: "ARAMIS", // Assuming a fixed user ID for now
              SPECS: SPECS,
            },
          };

          // API call
          const PORT = 4004; // Ensure this matches your backend port

          fetch(
            `http://localhost:${PORT}/api/inv/simulation?strategy=${apiStrategyName}`, // Usar apiStrategyName
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

              const aChartData = this._prepareTableData(
                data.value?.[0]?.CHART_DATA || [],
                data.value?.[0]?.SIGNALS || []
              );
              const aSignals = data.value?.[0]?.SIGNALS || [];
              const oSummary = data.value?.[0]?.SUMMARY || {}; // Obtener el objeto SUMMARY

              // Update result model with transformed data for chart and table
              oResultModel.setData({
                hasResults: true,
                chart_data: aChartData,
                signals: aSignals,
                result: oSummary.REAL_PROFIT || 0, // Usar REAL_PROFIT del SUMMARY
                // Datos para el resumen de simulación (directamente del SUMMARY de la API)
                simulationName:
                  oStrategyModel
                    .getProperty("/strategies")
                    .find((s) => s.key === strategy)?.text || strategy,
                symbol: sSymbol,
                startDate: oStrategyModel.getProperty("/startDate"),
                endDate: oStrategyModel.getProperty("/endDate"),
                TOTAL_BOUGHT_UNITS: oSummary.TOTAL_BOUGHT_UNITS || 0,
                TOTAL_SOLD_UNITS: oSummary.TOTAL_SOLD_UNITS || 0,
                REMAINING_UNITS: oSummary.REMAINING_UNITS || 0,
                FINAL_CASH: oSummary.FINAL_CASH || 0,
                FINAL_VALUE: oSummary.FINAL_VALUE || 0,
                FINAL_BALANCE: oSummary.FINAL_BALANCE || 0,
                REAL_PROFIT: oSummary.REAL_PROFIT || 0,
                PERCENTAGE_RETURN: oSummary.PERCENTAGE_RETURN || 0,
              });

              // After new data is loaded, ensure chart feeds are updated based on current strategy
              // Esto es crucial para que el gráfico se actualice correctamente con las medidas de la nueva estrategia

              // Invalidate the VizFrame to force a re-render
              const oVizFrame = this.byId("idVizFrame");
              if (oVizFrame) {
                oVizFrame.invalidate(); // Invalidate the control to force re-rendering
                // oVizFrame.rerender(); // Explicitly rerender (though invalidate often triggers this) - NO ES NECESARIO
              }

              // Update balance
              var currentBalance = oStrategyModel.getProperty("/balance") || 0;
              var totalGain = oSummary.REAL_PROFIT || 0; // Usar la ganancia real del SUMMARY
              oStrategyModel.setProperty(
                "/balance",
                currentBalance + totalGain
              );
              MessageToast.show(
                "Se añadieron $" + totalGain.toFixed(2) + " a tu balance."
              );
            })
            .catch((error) => {
              console.error("Error:", error);
              MessageBox.error("Error al obtener datos de simulación");
            });
        },

        /**
         * Helper function to format a Date object to "YYYY-MM-DD" string.
         * Made public for use in XML view bindings.
         * @param {Date} oDate The date object to format.
         * @returns {string|null} The formatted date string or null if input is not a Date.
         */
        formatDate: function (oDate) {
          return oDate
            ? DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).format(
                oDate
              )
            : null;
        },

        /**
         * Helper function to format the count of signals by type.
         * @param {Array} aSignals The array of signal objects.
         * @param {string} sType The type of signal to count ('buy', 'sell', 'stop_loss').
         * @returns {number} The count of signals of the specified type.
         */
        formatSignalCount: function (aSignals, sType) {
          if (!Array.isArray(aSignals)) {
            return 0;
          }
          return aSignals.filter((signal) => signal.TYPE === sType).length;
        },

        /**
         * Helper function to format the count of stop loss signals.
         * @param {Array} aSignals The array of signal objects.
         * @returns {number} The count of stop loss signals.
         */
        formatStopLossCount: function (aSignals) {
          if (!Array.isArray(aSignals)) {
            return 0;
          }
          return aSignals.filter((signal) => signal.TYPE === "stop_loss")
            .length;
        },

        /**
         * Helper function to determine the ObjectStatus state based on signal type.
         * @param {string} sType The type of signal ('buy', 'sell', 'stop_loss').
         * @returns {string} The ObjectStatus state ('Success', 'Error', 'Warning', 'None').
         */
        formatSignalState: function (sType) {
          if (sType === "buy") {
            return "Success";
          } else if (sType === "sell") {
            return "Error";
          } else if (sType === "stop_loss") {
            return "Warning";
          }
          return "None";
        },

        /**
         * Helper function to format a signal price.
         * @param {number} fPrice The price of the signal.
         * @returns {string} The formatted price string.
         */
        formatSignalPrice: function (fPrice) {
          return fPrice ? fPrice.toFixed(2) + " USD" : "N/A";
        },

        /**
         * Helper function to prepare raw API data for both table and VizFrame.
         * Ensures dates are Date objects for the chart and numeric values are parsed.
         * @param {Array} aData Raw data from API (e.g., CHART_DATA).
         * @param {Array} aSignals Signal data from API.
         * @returns {Array} Transformed data suitable for binding.
         * @private
         */
        _prepareTableData: function (aData, aSignals) {
          if (!Array.isArray(aData)) return [];

          return aData.map((oItem, index) => {
            // Encuentra la señal correspondiente para esta fecha, si existe
            const signal = aSignals.find((s) => s.DATE === oItem.DATE) || {};

            let dateObject = null;
            // Convert date string "YYYY-MM-DD" to a Date object.
            // This is CRUCIAL for VizFrame's time axis.
            if (
              typeof oItem.DATE === "string" &&
              oItem.DATE.match(/^\d{4}-\d{2}-\d{2}$/)
            ) {
              dateObject = new Date(oItem.DATE);
            } else if (oItem.DATE instanceof Date) {
              dateObject = oItem.DATE;
            }

            // Extract indicator values from the INDICATORS array
            let shortMA = null;
            let longMA = null;
            let rsi = null;
            let sma = null; // Variable para la SMA simple

            if (Array.isArray(oItem.INDICATORS)) {
              oItem.INDICATORS.forEach((indicator) => {
                // Asegúrate de que estos nombres coincidan EXACTAMENTE con lo que tu API devuelve
                // Por ejemplo, si tu API devuelve "SHORT_MA" (mayúsculas), cambia aquí a "SHORT_MA"
                if (indicator.INDICATOR === "short_ma") {
                  shortMA = parseFloat(indicator.VALUE);
                } else if (indicator.INDICATOR === "long_ma") {
                  longMA = parseFloat(indicator.VALUE);
                } else if (indicator.INDICATOR === "rsi") {
                  rsi = parseFloat(indicator.VALUE);
                } else if (indicator.INDICATOR === "sma") {
                  // Nuevo indicador para Reversión Simple
                  sma = parseFloat(indicator.VALUE);
                }
              });
            }

            // Construcción dinámica de la cadena de texto de indicadores para la tabla
            let indicatorParts = [];
            if (shortMA !== null && !isNaN(shortMA)) {
              indicatorParts.push(`SMA Corta: ${shortMA.toFixed(2)}`); // Formatear a 2 decimales
            }
            if (longMA !== null && !isNaN(longMA)) {
              indicatorParts.push(`SMA Larga: ${longMA.toFixed(2)}`); // Formatear a 2 decimales
            }
            if (rsi !== null && !isNaN(rsi)) {
              indicatorParts.push(`RSI: ${rsi.toFixed(2)}`); // Formatear a 2 decimales
            }
            if (sma !== null && !isNaN(sma)) {
              // Incluir SMA simple si tiene valor
              indicatorParts.push(`SMA: ${sma.toFixed(2)}`); // Formatear a 2 decimales
            }

            const indicatorsText =
              indicatorParts.length > 0 ? indicatorParts.join(", ") : "N/A";

            return {
              DATE_GRAPH: dateObject, // Property for VizFrame (Date object)
              DATE: dateObject
                ? DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).format(
                    dateObject
                  )
                : null, // Property for table (formatted string)
              OPEN: parseFloat(oItem.OPEN),
              HIGH: parseFloat(oItem.HIGH),
              LOW: parseFloat(oItem.LOW),
              CLOSE: parseFloat(oItem.CLOSE),
              VOLUME: parseFloat(oItem.VOLUME),
              // Properties for chart measures (will be null if not present for a given row)
              SHORT_MA: shortMA,
              LONG_MA: longMA,
              RSI: rsi,
              SMA: sma, // Asegúrate de incluir SMA aquí para que el gráfico pueda acceder a él
              // Signal points on chart (only show value if a signal exists)
              BUY_SIGNAL:
                signal.TYPE === "buy" ? parseFloat(oItem.CLOSE) : null,
              SELL_SIGNAL:
                signal.TYPE === "sell" ? parseFloat(oItem.CLOSE) : null,
              // Propiedades para la tabla (ej. texto combinado de indicadores)
              INDICATORS_TEXT: indicatorsText, // Usamos la cadena construida dinámicamente

              SIGNALS: signal.TYPE
                ? "ACCIÓN " + signal.TYPE.toUpperCase()
                : "SIN ACCIÓN", // Convertir a mayúsculas
              RULES: signal.REASONING
                ? "RAZÓN " + signal.REASONING
                : "SIN RAZÓN",
              SHARES: signal.SHARES ?? 0,
              // Añadir propiedades de señal para el fragmento de última operación
              type: signal.TYPE || "",
              price: signal.PRICE || 0,
              reasoning: signal.REASONING || "",
            };
          });
        },

        /**
         * Dynamically updates the list of measures displayed on the VizFrame's value axis.
         * This function is called onInit and when the strategy changes.
         * @private
         */
        _updateChartMeasuresFeed: function () {
          const oStrategyAnalysisModel = this.getView().getModel(
            "strategyAnalysisModel"
          );
          const sStrategyKey =
            oStrategyAnalysisModel.getProperty("/strategyKey");

          // Define las medidas base que siempre deben estar presentes
          // ¡IMPORTANTE! Usar los NOMBRES de las MeasureDefinition del XML, no los nombres de las propiedades de los datos.
          let aMeasures = ["PrecioCierre", "Señal BUY", "Señal SELL"];

          // Añade medidas adicionales según la estrategia seleccionada
          if (sStrategyKey === "MACrossover") {
            aMeasures.push("SHORT_MA", "LONG_MA"); // Estos nombres coinciden en tu XML
          } else if (sStrategyKey === "Reversión Simple") {
            aMeasures.push("RSI", "SMA"); // Estos nombres coinciden en tu XML
          }

          // Actualiza la propiedad del modelo con las medidas actuales
          oStrategyAnalysisModel.setProperty("/chartMeasuresFeed", aMeasures);
          console.log("Medidas actualizadas en el modelo:", aMeasures);

          const oVizFrame = this.byId("idVizFrame");
          if (oVizFrame) {
            // Obtener el dataset actual
            const oDataset = oVizFrame.getDataset();
            if (oDataset) {
              // Eliminar feeds existentes para valueAxis
              const aCurrentFeeds = oVizFrame.getFeeds();
              for (let i = aCurrentFeeds.length - 1; i >= 0; i--) {
                const oFeed = aCurrentFeeds[i];
                if (oFeed.getUid() === "valueAxis") {
                  oVizFrame.removeFeed(oFeed);
                }
              }

              // Crear y añadir un nuevo FeedItem para valueAxis con las medidas actualizadas
              const oNewValueAxisFeed = new FeedItem({
                uid: "valueAxis",
                type: "Measure",
                values: aMeasures,
              });
              oVizFrame.addFeed(oNewValueAxisFeed);
              console.log(
                "Nuevo Feed 'valueAxis' añadido con:",
                oNewValueAxisFeed.getValues()
              );

              // Forzar la actualización del dataset si es necesario (a veces ayuda)
              // oDataset.setModel(oVizFrame.getModel("strategyResultModel")); // Esto puede ser redundante si el binding ya está bien

              // Invalida el VizFrame para forzar un re-renderizado
              oVizFrame.invalidate();
              console.log(
                "VizFrame invalidado y feeds re-establecidos para redibujar con nuevas medidas."
              );
            } else {
              console.warn("Dataset no encontrado en el VizFrame.");
            }
          } else {
            console.warn("VizFrame con ID 'idVizFrame' no encontrado.");
          }
        },

        /**
         * Event handler for refreshing chart data.
         * Triggers a new analysis run with the current symbol.
         */
        onRefreshChart: function () {
          const oSymbolModel = this.getView().getModel("symbolModel");
          const sCurrentSymbol = this.byId("symbolSelector").getSelectedKey(); // Get selected symbol

          if (sCurrentSymbol) {
            this.onRunAnalysisPress(); // Recalculate and update chart data
          } else {
            const aSymbols = oSymbolModel.getProperty("/symbols");
            if (aSymbols && aSymbols.length > 0) {
              const sDefaultSymbol = aSymbols[0].symbol;
              this.byId("symbolSelector").setSelectedKey(sDefaultSymbol); // Set default if none selected
              this.onRunAnalysisPress();
            } else {
              MessageToast.show("Por favor, seleccione un símbolo.");
            }
          }
        },

        /**
         * Event handler for data point selection on the VizFrame.
         * Updates the ViewModel with selected point's data.
         * @param {sap.ui.base.Event} oEvent The event object
         */
        onDataPointSelect: function (oEvent) {
          const oData = oEvent.getParameter("data");
          console.log("Datos seleccionados:", oData);

          if (oData && oData.length > 0) {
            const oSelectedData = oData[0];
            console.log("Datos del punto seleccionado:", oSelectedData);

            const sFecha = oSelectedData.data.DATE_GRAPH; // This should be a Date object
            const fPrecioCierre = oSelectedData.data.CLOSE;

            if (sFecha && fPrecioCierre !== undefined) {
              const oViewModel = this.getView().getModel("viewModel");
              oViewModel.setProperty("/selectedPoint", {
                DATE: sFecha,
                CLOSE: fPrecioCierre,
              });
            } else {
              console.warn(
                "Los datos seleccionados no contienen DATE_GRAPH o CLOSE."
              );
            }
          } else {
            console.warn("No se seleccionaron datos.");
          }
        },

        /**
         * Event handler for showing investment history popover.
         * @param {sap.ui.base.Event} oEvent The event object
         */
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
          this._oHistoryPopover.openBy(oEvent.getSource());
        },

        /**
         * Toggles the visibility of advanced filters in the history popover.
         */
        onToggleAdvancedFilters: function () {
          if (!this._oHistoryPopover) return;

          const oPanel = sap.ui.getCore().byId("advancedFiltersPanel"); // Access panel from core if it's not a direct child of the view

          if (oPanel) {
            oPanel.setVisible(!oPanel.getVisible());
          } else {
            console.warn("Advanced filters panel not found.");
          }
        },
      }
    );
  }
);
