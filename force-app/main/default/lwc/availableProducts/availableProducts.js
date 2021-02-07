/* This component shows Products list from Standard price book to be added to the order. 
* Products data is appended by blocks of records to lightning-datatable element when user scrolls through the table.
* When user select records to be added for current Order and press Add button message is published on Lightning Message Channel
* holding selected Product items information. 
* Component also receives and process message if Order was successfully confirmed in external system and disables Add button to lock
* Order for adding new items. */
import { LightningElement, wire, api } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { reduceErrors } from 'c/ldsUtils';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import MESSAGE_CHANNEL from '@salesforce/messageChannel/OrderDataChannel__c';

/* Apex method import. */
import getProductsData from '@salesforce/apex/ProductDataProvider.getProductsData';

/* Component name for debug messages. */
const COMPONENT = '[AVAILABLE PRODUCTS]';

/* Datatable columns definition. */
const columns = [
    { label: 'Name', fieldName: 'productName', editable: false },
    { label: 'List Price', fieldName: 'productPrice', editable: false }];

/* Order records fields to be queried by LDS @wire service. */
const FIELDS = [
        'Order.Name',
        'Order.OrderNumber',
        'Order.Status',
        'Order.TotalAmount'
    ];

/* Initial data offset for datatable. */
const INITIAL_OFFSET = 0;

export default class AvailableProducts extends LightningElement {
    /* Properties hold current Record Id and response from @wire LDS service with updated Order record data. */
    @api recordId;
    order;

    /* Lightning Message Service subscription info. */
    subscription = null;

    /* Property holds Add button state. */
    disabled = false;

    /* Properties hold table columns definitions and rows data. */
    columns = columns;
    maxRows;
    tableData = []; 
    tableElement;
    selectedRows = [];

    /* Data offset for loadMore table method. */
    offset = INITIAL_OFFSET;

    /* Get current record data through LDS @wire service. */
    @wire(getRecord,{ recordId : '$recordId', fields : FIELDS })
    wiredOrder ({ error, data }) {
        if (data) {
            console.log(COMPONENT +' @wire data',data);
            this.order = data;
            /* Enable or disable Add button based on Order Status. */
            if(data.fields.Status.value === 'Activated'){
                this.disabled = true;
            }else{
                this.disabled = false;
            }
        } else if (error) {
            this.error = error;
            this.showErrorToast(error);
        }
    }

    /* Unsubscribe will be called automatically on component descruction. */
    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        /* Subscribe to Message Channel to get Order confirmation updates from CurrentOrder component. */
        this.subscribe();

        /* Read initial data block for the table when componend added to DOM. */
        getProductsData( {orderId : this.recordId, offset : this.offset} )
            .then(data => {
                console.log(COMPONENT+' Apex getProductsData()',data);
                this.tableData = data.productList;
                this.offset = this.offset + data.productList.length;
                this.maxRows = data.pbeSize;
            })
            .catch(error => {
                this.showErrorToast(error);
            });
    }


    /* Lightning Message Channel subscription methods. */
    subscribe() {
        if(this.subscription) {
            return;
        }
        this.subscription = subscribe(this.messageContext, MESSAGE_CHANNEL, (message) => {
            this.handleMessage(message);
        });
    }


    /* Handle Order confirmation message from CurrentOrder component. */
    handleMessage(message){
        console.log(COMPONENT+' handleMessage()', message);
        if(message.TYPE === 'Confirmation'){
            this.disabled = true;
        }
    }

    /* Load next data block from database whe user scrolls down through the table. */
    loadMore(event) {
        if(event.target){
            /* Display spinner when data is loading. */
            event.target.isLoading = true;
        }
        
        this.tableElement = event.target;

        getProductsData( {orderId : this.recordId, offset : this.offset} )
            .then(data => {
                console.log(COMPONENT+' getProductsData()', data);
                this.tableData = this.tableData.concat(data.productList); 
                this.offset = this.offset + data.productList.length;
                if (this.tableData.length  >= this.maxRows) {
                    this.tableElement.enableInfiniteLoading = false;
                }
                
                if(this.tableElement){
                    /* Remove spinner. */
                    this.tableElement.isLoading = false;
                } 
            }
        )
        .catch(error => {
            this.showErrorToast(error);
        });
    }

        
    /* Get rows selection from datatable. */
    getSelectedRows(event) {
        console.log(COMPONENT+' getSelectedRows()', event);
        this.selectedRows = event.detail.selectedRows;
    }


    /* Read rows selection from datatable and publish message for CurrentOrder component to upsert selected records. */
    addOrderItem(event){
        console.log(COMPONENT+' addOrderItem()',this.selectedRows);
        if(this.selectedRows.length){
            const message = {'TYPE' : 'OrderItems', 'Array' : this.selectedRows};
            publish(this.messageContext, MESSAGE_CHANNEL, message);
        }
    }


    /* Show error toast with defined message on error. */
    showErrorToast(error) {
        let message = reduceErrors(error).join(', ');
        console.log(COMPONENT+' Error', message);
        const evt = new ShowToastEvent({
            title: 'Server Error',
            message: message,
            variant: 'error',
        });
        this.dispatchEvent(evt);
    }

}