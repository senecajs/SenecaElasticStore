type ElasticSearchStoreOptions = {
    debug: boolean;
    map?: any;
    index: {
        prefix: string;
        suffix: string;
        map: Record<string, string>;
        exact: string;
    };
    field: {
        zone: {
            name: string;
        };
        base: {
            name: string;
        };
        name: {
            name: string;
        };
        vector: {
            name: string;
        };
    };
    cmd: {
        list: {
            size: number;
        };
    };
    elasticsearch: {
        node: string;
    };
};
declare function ElasticSearchStore(this: any, options: ElasticSearchStoreOptions): {
    name: string;
    exportmap: {
        native: () => {
            client: any;
        };
    };
};
export default ElasticSearchStore;
