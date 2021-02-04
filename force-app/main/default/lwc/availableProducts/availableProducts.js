import { LightningElement, wire, api } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish,createMessageContext,releaseMessageContext, subscribe, unsubscribe } from 'lightning/messageService';
import ORDER_MC from '@salesforce/messageChannel/OrderDataChannel__c';
import getProductsData from '@salesforce/apex/ProductDataProvider.getProductsData';

const columns = [
    { label: 'Name', fieldName: 'productName', editable: false },
    { label: 'List Price', fieldName: 'productPrice', editable: false }];

const FIELDS = [
        'Order.Name',
        'Order.OrderNumber',
        'Order.Status',
        'Order.TotalAmount'
    ];

const INITIAL_OFFSET = 0;

export default class AvailableProducts extends LightningElement {
    @api recordId;
    order;

    context = createMessageContext();
    subscription = null;

    disabled = false;

    columns = columns;
    maxRows;
    tableData = []; 
    tableElement;
    selectedRows;

    offset = INITIAL_OFFSET;

    @wire(getRecord,{ recordId : '$recordId', fields : FIELDS })
    wiredOrder ({ error, data }) {
        if (data) {
            console.log('wiredOrder',JSON.stringify(data));
            this.order = data;
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
        getProductsData( {orderId : this.recordId, offset : this.offset} )
            .then(data => {
                console.log('getProductsData',data.productList.length);
                this.tableData = data.productList;
                this.offset = this.offset + data.productList.length;
                this.maxRows = data.pbeSize;
            })
            .catch(error => {
                this.showErrorToast(error);
            });

        this.subscribeMC();
    }


    subscribeMC() {
        if(this.subscription) {
            return;
        }
        this.subscription = subscribe(this.context, ORDER_MC, (message) => {
            this.handleMessage(message);
        });
    }


    unsubscribeMC() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }


    disconnectedCallback() {
        releaseMessageContext(this.context);
    }


    handleMessage(message){
        console.log('handleMessage',JSON.stringify(message));
        if(message.TYPE === 'Confirmation'){
            this.disabled = true;
        }
    }


    loadMore(event) {
        console.log('Load more: ',JSON.stringify(event));
        
        if(event.target){
            event.target.isLoading = true;
        }
        
        this.tableElement = event.target;
        this.loadStatus = 'Loading';

        getProductsData( {orderId : this.recordId, offset : this.offset} )
            .then(data => {
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


    showErrorToast(error) {
        console.log('Error',error);
        const evt = new ShowToastEvent({
            title: 'Server Error',
            message: error.body.message,
            variant: 'error',
        });
        this.dispatchEvent(evt);
    }
        

    getSelectedRows(event) {
        console.log('getSelectedRows', event);
        this.selectedRows = event.detail.selectedRows;
    }


    addOrderItem(event){
        console.log('this.selectedRows',this.selectedRows);
        if(this.selectedRows.length){
            const message = {'TYPE' : 'OrderItems', 'Array' : this.selectedRows};
            publish(this.context, ORDER_MC, message);
        }
    }


}