// frontend/src/pages/AdminPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Link } from 'react-router-dom';

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
};

const columnHelper = createColumnHelper();

function AdminPage() {
    // Destructure refreshAdminTasksCount from useAuth
    const { user, token, refreshAdminTasksCount } = useAuth(); 
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // For server-side pagination and filtering by status
    const [filterStatus, setFilterStatus] = useState('pending'); // Default to show pending
    const [pagination, setPagination] = useState({
        pageIndex: 0, // TanStack Table uses 0-based index
        pageSize: 10,
    });
    const [pageCount, setPageCount] = useState(0); // Total pages from server

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('status', filterStatus);
            params.append('page', pagination.pageIndex + 1); // API uses 1-based page
            params.append('limit', pagination.pageSize);

            const response = await axios.get(`http://localhost:5000/api/admin/listings?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setListings(response.data.listings);
            setPageCount(response.data.totalPages);

            // When admin views this page, refresh their task count in the AuthContext
            if (user?.role === 'admin') {
                refreshAdminTasksCount();
            }

        } catch (err) {
            console.error("Error fetching listings for admin:", err);
            setError(err.response?.data?.message || "Failed to load listings.");
        } finally {
            setLoading(false);
        }
    }, [token, filterStatus, pagination.pageIndex, pagination.pageSize, user?.role, refreshAdminTasksCount]); // Add dependencies for refreshAdminTasksCount and user.role

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (listingId, newStatus) => {
        const originalListings = [...listings];
        setListings(prev => prev.map(l => l.id === listingId ? {...l, isUpdating: true} : l));
        try {
            await axios.put(
                `http://localhost:5000/api/admin/listings/${listingId}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Refetch data to get the updated list and pagination.
            // This will also trigger refreshAdminTasksCount via the fetchData useCallback.
            fetchData(); 
        } catch (err) {
            console.error(`Error updating listing ${listingId} to ${newStatus}:`, err);
            alert(err.response?.data?.message || `Failed to update status. ${err.message}`);
            setListings(originalListings); // Rollback on error
        }
    };

    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: 'ID',
            cell: info => info.getValue(),
        }),
        columnHelper.accessor('title', {
            header: 'Title',
            cell: info => (
                <Link to={`/listings/${info.row.original.id}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {info.getValue()}
                </Link>
            ),
        }),
        columnHelper.accessor('Owner.name', {
            header: 'Owner',
            cell: info => info.getValue() || info.row.original.Owner?.email || 'N/A',
        }),
        columnHelper.accessor('price', {
            header: 'Price',
            cell: info => `$${parseFloat(info.getValue()).toFixed(2)} ${info.row.original.type === 'rent' ? '/month' : ''}`,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: info => {
                const status = info.getValue();
                let bgColor = 'bg-gray-100';
                let textColor = 'text-gray-800';
                if (status === 'active') { bgColor = 'bg-green-100'; textColor = 'text-green-800'; }
                else if (status === 'pending') { bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; }
                else if (status === 'rejected') { bgColor = 'bg-red-100'; textColor = 'text-red-800'; }
                return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bgColor} ${textColor}`}>{status}</span>;
            },
        }),
        columnHelper.accessor('created_at', {
            header: 'Submitted',
            cell: info => formatDate(info.getValue()),
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => {
                const listing = row.original;
                if (listing.isUpdating) {
                    return <span className="text-xs text-gray-500">Updating...</span>;
                }
                return (
                    <div className="space-x-2">
                        {listing.status === 'pending' && (
                            <>
                                <button
                                    onClick={() => handleUpdateStatus(listing.id, 'active')}
                                    className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-sm"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(listing.id, 'rejected')}
                                    className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-sm"
                                >
                                    Reject
                                </button>
                            </>
                        )}
                        {listing.status === 'active' && (
                             <button
                                onClick={() => handleUpdateStatus(listing.id, 'rejected')} // Admin might want to reject an active listing
                                className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2 rounded-sm"
                            >
                                Reject
                            </button>
                        )}
                         {listing.status === 'rejected' && (
                             <button
                                onClick={() => handleUpdateStatus(listing.id, 'active')} // Admin might want to re-approve
                                className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2 rounded-sm"
                            >
                                Approve
                            </button>
                        )}
                    </div>
                );
            },
        }),
    ], [handleUpdateStatus]); // Added handleUpdateStatus as dependency

    const table = useReactTable({
        data: listings,
        columns,
        pageCount: pageCount, // Server-side page count
        state: {
            pagination,
        },
        onPaginationChange: setPagination, // Setter for pagination state
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(), // Optional: if you want client-side sorting on current page
        manualPagination: true, // Crucial for server-side pagination
        // manualSorting: true, // If you implement server-side sorting
        debugTable: false, // Set to true for debugging
    });

    if (loading && listings.length === 0) { // Show loading only on initial load or when listings are empty
        return <div className="container mx-auto px-4 py-8 text-center">Loading listings...</div>;
    }
    if (error) {
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Panel - Listing Moderation</h1>

            <div className="mb-4">
                <label htmlFor="statusFilter" className="mr-2 font-medium text-gray-700">Filter by status:</label>
                <select
                    id="statusFilter"
                    value={filterStatus}
                    onChange={(e) => {
                        setFilterStatus(e.target.value);
                        // Reset to first page when filter changes
                        setPagination(prev => ({ ...prev, pageIndex: 0 })); 
                    }}
                    className="border-gray-300 rounded-sm p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>                   
                    <option value="archived">Archived</option> {/* View archived listings */}
                </select>
            </div>

            {listings.length === 0 && !loading ? (
                <p className="text-center text-gray-600">No listings found for the selected status.</p>
            ) : (
            <div className="overflow-x-auto bg-white shadow-md rounded-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}

            {/* Pagination Controls */}
            {pageCount > 1 && (
                <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                        Page{' '}
                        <strong>
                            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                        </strong>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-sm text-sm hover:bg-gray-300 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-sm text-sm hover:bg-gray-300 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPage;