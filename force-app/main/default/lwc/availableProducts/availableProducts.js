/* This component shows Products list from Standard price book to be added to the order. 
* Products data is appended by blocks of records to lightning-datatable element when user scrolls through the table.
* When user select records to be added for current Order and press Add button message is published on Lightning Message Channel
* holding selected Product items information. 
* Component also receives and process message if Order was successfully confirmed in external system and disables Add button to lock
* Order for adding new items. */
import { LightningElement, wire, api } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish,createMessageContext,releaseMessageContext, subscribe, unsubscribe } from 'lightning/messageService';
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

    /* Properties holds Lightning Message Service data. */
    context = createMessageContext();
    subscription = null;

    /* Property holds Add button state. */
    disabled = false;

    /* Properties hold table columns definitions and rows data. */
    columns = columns;
    maxRows;
    tableData = []; 
    tableElement;
    selectedRows = [];

    /* Data offset for loadMore table nethod for scrolling. */
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

    connectedCallback() {
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

        /* Subscribe to Message Channel to get Order confirmation updates from CurrentOrder component. */
        this.subscribe();
    }


    /* Lightning Message Channel subscription methods. */
    subscribe() {
        if(this.subscription) {
            return;
        }
        this.subscription = subscribe(this.context, MESSAGE_CHANNEL, (message) => {
            this.handleMessage(message);
        });
    }


    unsubscribe() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }


    disconnectedCallback() {
        releaseMessageContext(this.context);
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
            event.target.isLoading = true;
        }
        
        this.tableElement = event.target;
        this.loadStatus = 'Loading';

        getProductsData( {orderId : this.recordId, offset : this.offset} )
            .then(data => {
                console.log(COMPONENT+' getProductsData()', data);
                this.tableData = this.tableData.concat(data.productList); 
                this.offset = this.offset + data.productList.length;
                this.loadStatus = '';
                if (this.tableData.length  >= this.maxRows) {
                    this.tableElement.enableInfiniteLoading = false;
                    this.loadStatus = 'No more data to load';
                }
                
                if(this.tableElement){
                    this.tableElement.isLoading = false;
                } 
            }
        )
        .catch(error => {
            this.showErrorToast(error);
        });
    }

    /* Show error toast with defined message. */
    showErrorToast(error) {
        console.log(COMPONENT+' Error',error);
        const evt = new ShowToastEvent({
            title: 'Server Error',
            message: error.body.message,
            variant: 'error',
        });
        this.dispatchEvent(evt);
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
            publish(this.context, MESSAGE_CHANNEL, message);
        }
    }

}